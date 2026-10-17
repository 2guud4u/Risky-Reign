/**
 * Soldier actions: moving a garrisoned soldier, healing one, capturing a
 * settlement/city with a group, and fighting the robber 1v1. The check half
 * comes from common's validators; the apply half (per-turn tracking, undo
 * entries, road transfers, heal payment, battle creation) lives here.
 * fightRobber only creates the robber-fight BattleState — its outcome is
 * applied later by the battle domain (see rollBattleDie).
 */
import {
  canMoveSoldierTo,
  canHealSoldierAt,
  canCaptureSettlementAt,
  captureRoadTransfers,
  canFightRobber,
  createRobberBattleState,
  rollDie,
  subtractPrice,
  healPriceFor,
  ResourceKey,
  GameRoom,
  Player,
} from 'common';
import type { ActionEntry } from '../dispatch';

const fail = (error: string) => ({ error });

export const SOLDIER_ACTIONS: Record<string, ActionEntry> = {
  moveSoldier: {
    run: (
      room: GameRoom,
      currentPlayer: Player,
      { soldierId, targetVertexId }: { roomId: string; soldierId: string; targetVertexId: string }
    ) => {
      const board = room.board;
      if (!board) return fail('Game board is not available');
      const turnState = room.turnState;

      // Authoritative rules live in common (shared with the UI).
      const check = canMoveSoldierTo(board, turnState, currentPlayer.name, soldierId, targetVertexId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot move soldier there');

      // Move the soldier to the new vertex.
      const soldier = board.soldiers[soldierId];
      if (soldier) {
        const originalVertexId = soldier.vertexId;
        soldier.vertexId = targetVertexId;

        // Record the move so it can be undone (returns the soldier to its
        // original vertex and refunds its action for this phase).
        turnState.undoLog.push({
          kind: 'moveSoldier',
          soldierId,
          originalVertexId,
        });
      }

      // Each soldier gets one action per Action phase (Rules.md line 30).
      turnState.soldiersActedThisTurn.push(soldierId);
    },
  },

  captureSettlement: {
    run: (
      room: GameRoom,
      currentPlayer: Player,
      { soldierId, vertexId }: { roomId: string; soldierId: string; vertexId: string }
    ) => {
      const board = room.board;
      if (!board) return fail('Game board is not available');
      const turnState = room.turnState;

      // Authoritative rules live in common (shared with the UI). A capture
      // is done by exactly one soldier (own, on the vertex, no enemy or
      // other troops there, action still available).
      if (typeof soldierId !== 'string') return fail('Pick one soldier to capture with');
      const check = canCaptureSettlementAt(board, turnState, currentPlayer.name, soldierId, vertexId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot capture this settlement');

      // Transfer the settlement/city to the acting player, recording the
      // previous owner so the capture can be undone this phase. Also
      // transfer to the capturer the road(s) sandwiched between the captured
      // vertex and their other settlements/cities (Rules.md "capture
      // settlement/city"), recording the previous road owners for undo.
      const vertex = board.vertices[vertexId];
      const settlement = vertex?.settlementId ? board.settlements[vertex.settlementId] : undefined;
      if (settlement) {
        const roadTransfers = captureRoadTransfers(board, currentPlayer.name, vertexId);
        turnState.undoLog.push({
          kind: 'captureSettlement',
          settlementId: settlement.id,
          originalOwnerId: settlement.ownerId,
          soldierId,
          roadTransfers,
        });
        settlement.ownerId = currentPlayer.name;
        for (const t of roadTransfers) {
          const road = board.roads[t.roadId];
          if (road) road.ownerId = currentPlayer.name;
        }
      }

      // The capturing soldier spends its one action per Action phase (Rules.md line 30).
      turnState.soldiersActedThisTurn.push(soldierId);
    },
  },

  healSoldier: {
    run: (
      room: GameRoom,
      currentPlayer: Player,
      data: { roomId: string; soldierId: string; payWith?: ResourceKey }
    ) => {
      const { soldierId } = data;
      const payWith = data.payWith;
      const board = room.board;
      if (!board) return fail('Game board is not available');
      const turnState = room.turnState;

      // Authoritative rules live in common (shared with the UI), including the
      // heal payment choice: 1 card of either Wheat or Sheep.
      const check = canHealSoldierAt(board, turnState, currentPlayer.name, soldierId, currentPlayer.resources, payWith);
      if (!check.allowed) return fail(check.reason ?? 'Cannot heal this soldier');

      // Deduct the chosen heal resource (default to Wheat if unspecified) and
      // restore the soldier (Rules.md line 27).
      const cost = healPriceFor(payWith ?? (currentPlayer.resources.Wheat > 0 ? 'Wheat' : 'Sheep'));
      currentPlayer.resources = subtractPrice(currentPlayer.resources, cost);
      const soldier = board.soldiers[soldierId];
      if (soldier) {
        soldier.injured = false;
      }

      // Track this soldier so it cannot move this turn (Rules.md line 25).
      turnState.soldiersHealedThisTurn.push(soldierId);

      // Healing consumes the soldier's action for this phase.
      turnState.soldiersActedThisTurn.push(soldierId);
    },
  },

  fightRobber: {
    run: (
      room: GameRoom,
      currentPlayer: Player,
      { soldierId, vertexId }: { roomId: string; soldierId: string; vertexId: string }
    ) => {
      const board = room.board;
      if (!board) return fail('Game board is not available');
      const turnState = room.turnState;

      // Authoritative rules live in common (shared with the UI).
      const check = canFightRobber(room, currentPlayer.name, soldierId, vertexId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot fight the robber here');

      // Start a 1v1 battle against the robber: the HUD is shown, the player
      // rolls their soldier, and the robber's die is auto-rolled. The outcome
      // is applied when the round resolves (see the rollBattleDie handler).
      room.battleState = createRobberBattleState(room, currentPlayer.name, soldierId, vertexId);
      // Auto-roll the robber's die.
      room.battleState.states['Robber'].soldiers[0].rollNum = rollDie();
      // The fight consumes the soldier's action for this phase.
      turnState.soldiersActedThisTurn.push(soldierId);
    },
  },
};
