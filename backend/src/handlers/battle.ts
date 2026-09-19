import {
  canStartBattle,
  createBattleState,
  canRollBattleDie,
  rollBattleDie,
  allSoldiersRolled,
  resolveBattleRoundIfComplete,
  applyBonuses,
  Board,
  BattleState,
} from 'common';
import { gameRooms } from '../store';
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
    (data: { roomId: string; playerId: string; soldierIds: string[]; targetVertexId: string }) => {
      const { roomId, playerId, soldierIds, targetVertexId } = data;
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
      const check = canStartBattle(room, currentPlayer.name, soldierIds, targetVertexId);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot start a battle here' });
        return;
      }

      // Create the battle state and move to the battle phase.
      room.battleState = createBattleState(room, currentPlayer.name, soldierIds, targetVertexId);

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
      }

      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    }
  );

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
      room.battleState = { ...battle, phase: 'repositioning', injuredSettled };
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
    room.battleState = { ...battle, phase: 'repositioning', injuredSettled };

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

  // Any player in the room can dismiss the battle window once they have seen
  // the outcome. Any injured troops not yet repositioned simply stay where
  // the fight ended (injured until healed). The battle state is cleared only then.
  socket.on('exitBattle', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) return;
    if (room.battleState && (room.battleState.phase === 'finished' || room.battleState.phase === 'repositioning')) {
      room.battleState = null;
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
}
