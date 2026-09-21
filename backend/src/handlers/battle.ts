import {
  canStartBattle,
  createBattleState,
  canRollBattleDie,
  rollBattleDie,
  allSoldiersRolled,
  resolveBattleRoundIfComplete,
  applyBonuses,
  RESOURCES,
  canMoveRobberAdjacent,
  placeRobber,
  Board,
  BattleState,
  GameRoom,
  type UndoEntry,
} from 'common';
import { gameRooms, freshResourceCount } from '../store';
import { HandlerContext, blockIfFinished } from './context';

/**
 * Battle handlers: starting a battle, rolling dice, continuing/ending the
 * battle (with round resolution and casualties), repositioning an injured
 * soldier, and exiting (clearing the battle state).
 */
export function registerBattleHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  socket.on(
    'startAttack',
    (data: { roomId: string; playerId: string; soldierIds: string[]; targetVertexId: string; defenderName?: string }) => {
      const { roomId, playerId, soldierIds, targetVertexId, defenderName } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (blockIfFinished(room, socket)) return;
      const board = room.board;
      if (!board) {
        socket.emit('error', { message: 'Game board is not available' });
        return;
      }
      const turnState = room.turnState;
      const currentPlayer = room.players.find((p) => p.id === playerId);
      if (!currentPlayer) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }
      // A battle can only be started during the Action phase, on your turn.
      if (turnState.phase !== 'Action' || turnState.player !== currentPlayer.name) {
        socket.emit('error', { message: 'You can only start a battle on your turn in the Action phase' });
        return;
      }
      // A battle can only be started if no battle is already in progress.
      if (room.battleState) {
        socket.emit('error', { message: 'A battle is already in progress' });
        return;
      }

      // Authoritative rules live in common (shared with the UI).
      const check = canStartBattle(room, currentPlayer.name, soldierIds, targetVertexId, defenderName);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot start a battle here' });
        return;
      }

      // Create the battle state and move to the battle phase.
      room.battleState = createBattleState(room, currentPlayer.name, soldierIds, targetVertexId, defenderName);

      // Track the soldiers as having acted (Rules.md line 30).
      for (const sid of soldierIds) {
        turnState.soldiersActedThisTurn.push(sid);
      }

      io.to(roomId).emit('gameUpdate', { ...room });
    }
  );

  socket.on(
    'rollBattleDie',
    (data: { roomId: string; playerId: string; soldierId: string }) => {
      const { roomId, playerId, soldierId } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (blockIfFinished(room, socket)) return;
      const board = room.board;
      if (!board || !room.battleState) {
        socket.emit('error', { message: 'No battle in progress' });
        return;
      }
      const currentPlayer = room.players.find((p) => p.id === playerId);
      if (!currentPlayer) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }
      if (room.battleState.phase !== 'rolling') {
        socket.emit('error', { message: 'The battle is not in the rolling phase' });
        return;
      }
      const battle = room.battleState;
      const canRoll = canRollBattleDie(battle, currentPlayer.name, soldierId);
      if (!canRoll) {
        socket.emit('error', { message: 'Cannot roll for this soldier' });
        return;
      }

      // Roll the die and record the result.
      rollBattleDie(battle, currentPlayer.name, soldierId);

      // Once every soldier on both sides has rolled, resolve the round:
      // compute casualties and move to the betweenRounds phase.
      if (allSoldiersRolled(battle)) {
        room.battleState = resolveBattleRoundIfComplete(battle).updatedBattleState;
        // Robber fight: a single round. Once resolved, apply the outcome
        // (win → take the bag; lose → the soldier is killed) and end the
        // battle so the player can dismiss it.
        if (battle.robberFight) {
          applyRobberFightOutcome(room, battle);
          room.battleState = { ...room.battleState, phase: 'repositioning', repositionTurn: initialRepositionTurn(battle) };
        }
      }

      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    }
  );

  /**
   * Apply the outcome of a resolved robber fight: the attacker wins only on a
   * strictly higher roll (the robber wins ties). Win → take the robber bag;
   * lose → the robber kills the soldier. Records the undo entry and the
   * player's once-per-phase fight, and emits the result.
   */
  function applyRobberFightOutcome(room: GameRoom, battle: BattleState): void {
    const board = room.board!;
    const turnState = room.turnState;
    const attacker = room.players.find((p) => p.name === battle.attacker)!;
    const attackerSoldier = battle.states[battle.attacker].soldiers[0];
    const soldierId = attackerSoldier.soldier.id;
    const soldierRoll = attackerSoldier.rollNum ?? 0;
    const robberRoll = battle.states['Robber'].soldiers[0].rollNum ?? 0;
    const won = soldierRoll > robberRoll;

    // Record for undo: restore the soldier if it was killed, return the bag
    // if it was won.
    const soldier = board.soldiers[soldierId]!;
    turnState.undoLog.push({
      kind: 'fightRobber',
      playerName: battle.attacker,
      soldierId,
      result: won ? 'win' : 'lose',
      soldierSnapshot: { ...soldier },
      bagBefore: { ...room.robberBag },
    });

    if (won) {
      // The winner takes the entire robber bag.
      for (const r of RESOURCES) {
        attacker.resources[r] += room.robberBag[r];
      }
      room.robberBag = freshResourceCount(0);
      // The winner may move the robber to any adjacent hex (Rules.md).
      const robberHex = Object.values(board.hexes).find((h) => h.robber)?.id;
      if (robberHex) {
        room.robberDefeatedBy = { playerName: battle.attacker, fromHexId: robberHex };
      }
    } else {
      // The robber kills the soldier.
      delete board.soldiers[soldierId];
    }

    // The fight consumes the player's once-per-phase robber fight.
    turnState.robberFoughtThisPhase.push(battle.attacker);

    io.to(room.id).emit('robberFightResult', {
      playerName: battle.attacker,
      soldierId,
      soldierRoll,
      robberRoll,
      won,
    });
  }

  // Continue the battle to the next round: applies the resolved round's
  // casualties to the board, then either ends the battle (if a side has no
  // living troops left, entering repositioning) or resets all rolls and
  // starts the next round.
  socket.on('continueBattle', (data: { roomId: string; playerId: string }) => {
    const { roomId, playerId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfFinished(room, socket)) return;
    const board = room.board;
    if (!board || !room.battleState) {
      socket.emit('error', { message: 'No battle in progress' });
      return;
    }

    // Only the attacker can continue a battle (Rules.md line 7), and only
    // once the round has been resolved (betweenRounds).
    const currentPlayer = room.players.find((p) => p.id === playerId);
    if (!currentPlayer || currentPlayer.name !== room.battleState.attacker) {
      socket.emit('error', { message: 'Only the attacker can continue this battle' });
      return;
    }
    if (room.battleState.phase !== 'betweenRounds') {
      socket.emit('error', { message: 'The round has not been resolved yet' });
      return;
    }

    const battle = room.battleState;

    // Apply the resolved round's casualties to the board now: by continuing
    // (or ending) the battle the attacker has committed to the outcome.
    const injuredSettled = applyRoundCasualties(board, battle);

    // The battle ends when either side has no living, uninjured troops left.
    const attackersAlive = (battle.states[battle.attacker]?.soldiers ?? []).some(
      (s) => !s.dead && !s.injured
    );
    const defendersAlive = (battle.states[battle.defender]?.soldiers ?? []).some(
      (s) => !s.dead && !s.injured
    );

    if (!attackersAlive || !defendersAlive) {
      // A side is gone: continuing ends the battle. Injured survivors
      // stay put and the battle enters 'repositioning': the window shows the
      // outcome and lets each owner drag their injured troops along a road
      // to a neighboring vertex (or leave them in place).
      room.battleState = { ...battle, phase: 'repositioning', injuredSettled, repositionTurn: initialRepositionTurn(battle) };
    } else {
      // Both sides still standing: reset ALL rolls so no troop carries a
      // stale die into the next round. Injured troops are out of the fight
      // (Rule 28) and won't re-roll, but clearing their rollNum prevents
      // them from appearing in the matchup table.
      for (const side of Object.values(battle.states)) {
        for (const s of side.soldiers) {
          s.rollNum = null;
        }
      }
      room.battleState = { ...battle, phase: 'rolling', round: battle.round + 1, injuredSettled };
    }

    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  // The attacker may end the battle after any resolved round (betweenRounds),
  // at their choosing — even while both sides still have troops. Casualties
  // are committed to the board and the battle moves to repositioning.
  socket.on('endBattle', (data: { roomId: string; playerId: string }) => {
    const { roomId, playerId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfFinished(room, socket)) return;
    const board = room.board;
    if (!board || !room.battleState) {
      socket.emit('error', { message: 'No battle in progress' });
      return;
    }

    // Only the attacker can end a battle, and only once the round has been
    // resolved (betweenRounds).
    const currentPlayer = room.players.find((p) => p.id === playerId);
    if (!currentPlayer || currentPlayer.name !== room.battleState.attacker) {
      socket.emit('error', { message: 'Only the attacker can end this battle' });
      return;
    }
    if (room.battleState.phase !== 'betweenRounds') {
      socket.emit('error', { message: 'The round has not been resolved yet' });
      return;
    }

    const battle = room.battleState;
    const injuredSettled = applyRoundCasualties(board, battle);
    room.battleState = { ...battle, phase: 'repositioning', injuredSettled, repositionTurn: initialRepositionTurn(battle) };

    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  // A player drags one of their injured soldiers (from the repositioning
  // battle window) along a road to a neighboring vertex of its current
  // resting place. The board and the repositioning map are updated.
  socket.on(
    'repositionSoldier',
    (data: { roomId: string; playerId: string; soldierId: string; targetVertexId: string }) => {
      const { roomId, playerId, soldierId, targetVertexId } = data;
      const room = gameRooms.get(roomId);
      if (!room || !room.board || !room.battleState) {
        socket.emit('error', { message: 'No battle in progress' });
        return;
      }
      if (blockIfFinished(room, socket)) return;
      const currentPlayer = room.players.find((p) => p.id === playerId);
      if (!currentPlayer) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }
      if (room.battleState.phase !== 'repositioning') {
        socket.emit('error', { message: 'The battle is not in the repositioning phase' });
        return;
      }
      // The attacker repositions first; only the side whose turn it is may
      // move (Rules.md: "attacker gets to move injured soldiers away first").
      const turn = room.battleState.repositionTurn;
      if (turn !== undefined && turn !== null) {
        const isAttacker = currentPlayer.name === room.battleState.attacker;
        const isDefender = currentPlayer.name === room.battleState.defender;
        if (!isAttacker && !isDefender) {
          socket.emit('error', { message: 'Only a battle participant can reposition injured soldiers' });
          return;
        }
        if (turn !== (isAttacker ? 'attacker' : 'defender')) {
          socket.emit('error', { message: 'It is not your turn to reposition injured soldiers' });
          return;
        }
      }
      const soldier = room.board.soldiers[soldierId];
      if (!soldier || soldier.owner !== currentPlayer.name) {
        socket.emit('error', { message: 'You cannot move that soldier' });
        return;
      }
      // Must be one of this battle's injured survivors.
      if (!(room.battleState.injuredSettled ?? {})[soldierId]) {
        socket.emit('error', { message: 'Only injured soldiers from this battle can be moved' });
        return;
      }
      // Destination must be adjacent via an existing road.
      const from = soldier.vertexId;
      const fromVertex = room.board.vertices[from];
      const ok = fromVertex?.roadIds.some((edgeId) => {
        const edge = room.board?.edges[edgeId];
        if (!edge || edge.roadId === null) return false;
        const other = edge.vertexAId === from ? edge.vertexBId : edge.vertexAId;
        return other === targetVertexId;
      });
      if (!ok) {
        socket.emit('error', { message: 'That vertex is not reachable by a road from this soldier' });
        return;
      }
      soldier.vertexId = targetVertexId;
      soldier.stationed = false;
      room.battleState.injuredSettled = { ...room.battleState.injuredSettled, [soldierId]: targetVertexId };
      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    }
  );

  // The side whose repositioning turn it is signals they are done moving
  // their injured troops; the turn passes to the other side if they have
  // injured troops to settle (Rules.md: the attacker moves first).
  socket.on('finishRepositioning', (data: { roomId: string; playerId: string }) => {
    const { roomId, playerId } = data;
    const room = gameRooms.get(roomId);
    if (!room || !room.battleState) {
      socket.emit('error', { message: 'No battle in progress' });
      return;
    }
    if (blockIfFinished(room, socket)) return;
    const currentPlayer = room.players.find((p) => p.id === playerId);
    if (!currentPlayer) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }
    if (room.battleState.phase !== 'repositioning') {
      socket.emit('error', { message: 'The battle is not in the repositioning phase' });
      return;
    }
    const turn = room.battleState.repositionTurn;
    if (turn === undefined || turn === null) {
      socket.emit('error', { message: 'Repositioning is already finished' });
      return;
    }
    const isAttacker = currentPlayer.name === room.battleState.attacker;
    const isDefender = currentPlayer.name === room.battleState.defender;
    if (!isAttacker && !isDefender) {
      socket.emit('error', { message: 'Only a battle participant can finish repositioning' });
      return;
    }
    if (turn !== (isAttacker ? 'attacker' : 'defender')) {
      socket.emit('error', { message: 'It is not your turn to reposition injured soldiers' });
      return;
    }
    // All of this side's injured troops must be moved (off the battle
    // vertex) before the player can confirm.
    const mySide = isAttacker ? room.battleState.attacker : room.battleState.defender;
    const myInjured = (room.battleState.states[mySide]?.soldiers ?? []).filter(
      (s) => s.injured && !s.dead
    );
    const settled = room.battleState.injuredSettled ?? {};
    const allMoved = myInjured.every(
      (s) => settled[s.soldier.id] !== room.battleState!.vertexId
    );
    if (!allMoved) {
      socket.emit('error', { message: 'Move all your injured troops before confirming' });
      return;
    }
    const hasInjured = (name: string) =>
      (room.battleState!.states[name]?.soldiers ?? []).some((s) => s.injured && !s.dead);
    const next =
      turn === 'attacker' ? (hasInjured(room.battleState.defender) ? 'defender' : null) : null;
    room.battleState = { ...room.battleState, repositionTurn: next };
    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  // The winner of a robber fight moves the robber to a hex adjacent to its
  // current position (Rules.md: "after the robber is defeated, the winner
  // can move the robber to any adjacent hex").
  socket.on(
    'moveRobberAfterWin',
    (data: { roomId: string; playerId: string; hexId: string }) => {
      const { roomId, playerId, hexId } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (blockIfFinished(room, socket)) return;
      const board = room.board;
      if (!board) {
        socket.emit('error', { message: 'Game board is not available' });
        return;
      }
      const player = room.players.find((p) => p.id === playerId);
      if (!player) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }
      const choice = room.robberDefeatedBy;
      if (!choice) {
        socket.emit('error', { message: 'No robber fight to move from' });
        return;
      }
      if (choice.playerName !== player.name) {
        socket.emit('error', { message: 'Only the robber fight winner can move the robber' });
        return;
      }
      const check = canMoveRobberAdjacent(board, choice.fromHexId, hexId);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot move the robber there' });
        return;
      }
      // Record the move on the fight's undo entry so an undo restores the
      // robber to its pre-fight hex.
      const entry = [...room.turnState.undoLog]
        .reverse()
        .find(
          (e): e is Extract<UndoEntry, { kind: 'fightRobber' }> =>
            e.kind === 'fightRobber' && e.playerName === player.name
        );
      placeRobber(board, hexId);
      if (entry) {
        entry.robberMoved = { fromHexId: choice.fromHexId, toHexId: hexId };
      }
      room.robberDefeatedBy = null;
      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    }
  );

  // A player can dismiss the battle window once they have seen the outcome.
  // In the repositioning phase the window can be dismissed at any time: the
  // "attacker moves first" rule sets the ORDER of repositioning, not a gate
  // on exiting. Any injured troops not yet repositioned simply stay where the
  // fight ended (injured until healed).
  socket.on('exitBattle', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const bs = room.battleState;
    if (bs && (bs.phase === 'finished' || bs.phase === 'repositioning')) {
      room.battleState = null;
      room.robberDefeatedBy = null;
      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    }
  });

  // Apply a resolved battle round's casualties to the board. Injured
  // survivors are marked on the board and recorded in `injuredSettled` (their
  // resting vertex) so the repositioning phase can move them along a road.
  // Returns the resting-vertex map for the battle state.
  function applyRoundCasualties(board: Board, battleState: BattleState): Record<string, string> {
    const injuredSettled: Record<string, string> = {};
    for (const side of Object.values(battleState.states)) {
      for (const s of side.soldiers) {
        if (s.dead) {
          // Remove dead soldiers from the board.
          if (board.soldiers[s.soldier.id]) {
            delete board.soldiers[s.soldier.id];
          }
        } else if (s.injured) {
          // Mark the soldier as injured on the board and record its resting
          // vertex for repositioning.
          const soldier = board.soldiers[s.soldier.id];
          if (soldier) {
            soldier.injured = true;
            injuredSettled[s.soldier.id] = s.soldier.vertexId;
          }
        }
      }
    }
    return injuredSettled;
  }

  /**
   * The repositioning turn to start on (Rules.md: the attacker gets to move
   * injured soldiers away first): the attacker if they have injured troops,
   * else the defender if they do, else null (nothing to reposition).
   */
  function initialRepositionTurn(battle: BattleState): 'attacker' | 'defender' | null {
    const hasInjured = (name: string) =>
      (battle.states[name]?.soldiers ?? []).some((s) => s.injured && !s.dead);
    if (hasInjured(battle.attacker)) return 'attacker';
    if (hasInjured(battle.defender)) return 'defender';
    return null;
  }
}
