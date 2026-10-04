import { Server } from 'socket.io';
import {
  applyBonuses,
  RESOURCES,
  canMoveRobberAdjacent,
  placeRobber,
  nextRepositionTurn,
  Board,
  BattleState,
  GameRoom,
} from 'common';
import { gameRooms, freshResourceCount } from '../../store';
import { broadcastRoom } from '../../broadcast';
import { HandlerContext, blockIfCannotAct } from '../context';

/**
 * Battle-resolution handlers and helpers: committing a resolved round's
 * casualties to the board, continuing to the next round or ending the
 * battle (entering repositioning), applying a robber-fight outcome, and
 * moving the robber after a win.
 */
export function registerBattleResolutionHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  // Continue the battle to the next round: applies the resolved round's
  // casualties to the board, then either ends the battle (if a side has no
  // living troops left, entering repositioning) or resets all rolls and
  // starts the next round.
  socket.on('continueBattle', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    const board = room.board;
    if (!board || !room.battleState) {
      socket.emit('error', { message: 'No battle in progress' });
      return;
    }

    // Only the attacker can continue a battle (Rules.md line 7), and only
    // once the round has been resolved (betweenRounds).
    const currentPlayer = room.players.find((p) => p.id === socket.id);
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
      // A side is gone: continuing ends the battle and enters
      // 'repositioning': each owner must move their injured troops along a
      // road to a neighboring vertex (unless there is no road out).
      recordBattleWin(room, battle);
      room.battleState = { ...battle, phase: 'repositioning', injuredSettled, repositionTurn: nextRepositionTurn(board, battle, null) };
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
    broadcastRoom(io, room);
  });

  // The attacker may end the battle after any resolved round (betweenRounds),
  // at their choosing — even while both sides still have troops. Casualties
  // are committed to the board and the battle moves to repositioning.
  socket.on('endBattle', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    const board = room.board;
    if (!board || !room.battleState) {
      socket.emit('error', { message: 'No battle in progress' });
      return;
    }

    // Only the attacker can end a battle, and only once the round has been
    // resolved (betweenRounds).
    const currentPlayer = room.players.find((p) => p.id === socket.id);
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
    recordBattleWin(room, battle);
    room.battleState = { ...battle, phase: 'repositioning', injuredSettled, repositionTurn: nextRepositionTurn(board, battle, null) };

    applyBonuses(room);
    broadcastRoom(io, room);
  });

  // The winner of a robber fight moves the robber to a hex adjacent to its
  // current position (Rules.md: "after the robber is defeated, the winner
  // can move the robber to any adjacent hex").
  socket.on(
    'moveRobberAfterWin',
    (data: { roomId: string; hexId: string }) => {
      const { roomId, hexId } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (blockIfCannotAct(room, socket)) return;
      const board = room.board;
      if (!board) {
        socket.emit('error', { message: 'Game board is not available' });
        return;
      }
      const player = room.players.find((p) => p.id === socket.id);
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
      placeRobber(board, hexId);
      room.robberDefeatedBy = null;
      applyBonuses(room);
      broadcastRoom(io, room);
    }
  );
}

// Apply a resolved battle round's casualties to the board. Injured
// survivors are marked on the board and recorded in `injuredSettled` (their
// resting vertex) so the repositioning phase can move them along a road.
// Returns the resting-vertex map for the battle state.
export function applyRoundCasualties(board: Board, battleState: BattleState): Record<string, string> {
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
 * Count a won player-vs-player battle toward the Warmonger bonus: the battle
 * is won by the side that still has living, uninjured troops when the other
 * side has none. Robber fights and battles ended with both sides standing
 * have no winner and count for nobody.
 */
function recordBattleWin(room: GameRoom, battle: BattleState): void {
  if (battle.robberFight) return;
  const standing = (side: string) =>
    (battle.states[side]?.soldiers ?? []).some((s) => !s.dead && !s.injured);
  const atk = standing(battle.attacker);
  const def = standing(battle.defender);
  const winner = atk && !def ? battle.attacker : def && !atk ? battle.defender : null;
  if (!winner || !room.players.some((p) => p.name === winner)) return;
  room.battlesWon[winner] = (room.battlesWon[winner] ?? 0) + 1;
}

/**
 * Apply the outcome of a resolved robber fight: the attacker wins only on a
 * strictly higher roll (the robber wins ties). Win → take the robber bag;
 * lose → the robber kills the soldier. Records the undo entry and the
 * player's once-per-phase fight, and emits the result.
 */
export function applyRobberFightOutcome(io: Server, room: GameRoom, battle: BattleState): void {
  const board = room.board!;
  const turnState = room.turnState;
  const attacker = room.players.find((p) => p.name === battle.attacker)!;
  const attackerSoldier = battle.states[battle.attacker].soldiers[0];
  const soldierId = attackerSoldier.soldier.id;
  const soldierRoll = attackerSoldier.rollNum ?? 0;
  const robberRoll = battle.states['Robber'].soldiers[0].rollNum ?? 0;
  const won = soldierRoll > robberRoll;

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
