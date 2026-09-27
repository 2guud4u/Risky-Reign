import { applyBonuses } from 'common';
import { gameRooms } from '../../store';
import { broadcastRoom } from '../../broadcast';
import { HandlerContext, blockIfFinished } from '../context';

/**
 * Repositioning handlers: dragging injured soldiers along a road to a
 * neighboring vertex after a battle, finishing a side's repositioning
 * turn, and dismissing the battle window (which clears the battle state).
 */
export function registerBattleRepositioningHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  // A player drags one of their injured soldiers (from the repositioning
  // battle window) along a road to a neighboring vertex of its current
  // resting place. The board and the repositioning map are updated.
  socket.on(
    'repositionSoldier',
    (data: { roomId: string; soldierId: string; targetVertexId: string }) => {
      const { roomId, soldierId, targetVertexId } = data;
      const room = gameRooms.get(roomId);
      if (!room || !room.board || !room.battleState) {
        socket.emit('error', { message: 'No battle in progress' });
        return;
      }
      if (blockIfFinished(room, socket)) return;
      const currentPlayer = room.players.find((p) => p.id === socket.id);
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
      broadcastRoom(io, room);
    }
  );

  // The side whose repositioning turn it is signals they are done moving
  // their injured troops; the turn passes to the other side if they have
  // injured troops to settle (Rules.md: the attacker moves first).
  socket.on('finishRepositioning', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room || !room.battleState) {
      socket.emit('error', { message: 'No battle in progress' });
      return;
    }
    if (blockIfFinished(room, socket)) return;
    const currentPlayer = room.players.find((p) => p.id === socket.id);
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
    broadcastRoom(io, room);
  });

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
      broadcastRoom(io, room);
    }
  });
}
