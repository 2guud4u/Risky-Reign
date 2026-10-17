/**
 * Turn actions: dice rolling (with 7-robber setup and payouts), ending the
 * turn, undoing the acting player's last action, and resolving the robber —
 * its move (after a 7 or a knight), the steal that follows a 7, and the
 * pending 7-discards.
 */
import {
  addPrice,
  canPlaceRobberOn,
  CityPrice,
  computePayouts,
  applyPayouts,
  eligibleVictims,
  pendingBlock,
  placeRobber,
  playersAdjacentToHex,
  RESOURCES,
  RoadPrice,
  rollTotal,
  SettlementPrice,
  SoldierPrice,
  stealCard,
  GameRoom,
  Player,
  type TurnState,
} from 'common';
import { advanceTurn } from '../turn';
import type { ActionEntry } from '../dispatch';

const fail = (error: string) => ({ error });

/** Remove a soldier id from the per-turn tracking arrays (used by undo). */
function removeSoldierTracking(turnState: TurnState, soldierId: string): void {
  turnState.soldiersCreatedThisTurn = turnState.soldiersCreatedThisTurn.filter(
    (id) => id !== soldierId,
  );
  turnState.soldiersActedThisTurn = turnState.soldiersActedThisTurn.filter(
    (id) => id !== soldierId,
  );
}

export const TURN_ACTIONS: Record<string, ActionEntry> = {
  // Rolling one die per click during the Dice phase; a 7 sets up the
  // discards + robber move, any other total pays out and advances.
  rollDice: {
    run: (room: GameRoom, player: Player, _payload: { roomId: string }) => {
      const board = room.board;
      if (!board) return fail('Game board is not available');
      // Only the dice player may roll, and only during the Dice phase.
      if (room.turnState.phase !== 'Dice') return fail('It is not the Dice phase');
      const dicePlayer = room.turnState.player;
      if (player.name !== dicePlayer) return fail('It is not your turn to roll');

      // A pending 7 (robber move or steal) must be resolved before any
      // further roll.
      const block = pendingBlock(room, player.name, 'rollDice');
      if (block) return fail(block);

      // One die per click: the first click rolls die 1, the second rolls die 2.
      const roll = room.roll;
      const value = Math.floor(Math.random() * 6) + 1;
      if (roll.die1 === null) {
        room.roll = { die1: value, die2: null };
      } else if (roll.die2 === null) {
        room.roll = { die1: roll.die1, die2: value };
      } else {
        return fail('Both dice are already rolled');
      }

      // When both dice are in: a 7 holds the Dice phase until the robber is
      // moved (no payout — no hex carries a 7 token); any other total pays
      // out resources and advances to the Build phase automatically.
      if (room.roll.die1 !== null && room.roll.die2 !== null) {
        const total = rollTotal(room.roll.die1, room.roll.die2);
        if (total === 7) {
          room.robberMove = { player: dicePlayer, reason: 'seven' };
          // Standard 7: every player holding 8+ resource cards must discard
          // down to half (floor). Discards must be resolved before the
          // robber can be moved. Knocked-out players can't act, so they're
          // exempt (their discard would wedge the Dice phase).
          const discards: Record<string, number> = {};
          for (const p of room.players) {
            if (p.eliminated) continue;
            const hand = RESOURCES.reduce((sum, r) => sum + p.resources[r], 0);
            if (hand >= 8) discards[p.name] = Math.floor(hand / 2);
          }
          room.discards = discards;
        } else {
          const { payouts, robbed } = computePayouts(board, total);
          applyPayouts(room.players, payouts);
          for (const r of RESOURCES) room.robberBag[r] += robbed[r];
          advanceTurn(room);
        }
      }
    },
  },

  // Ending the turn: setup can't be skipped, the Dice phase advances on its
  // own, and pending resolutions (battle, won robber fight) hold the turn.
  endTurn: {
    run: (room: GameRoom, player: Player, _payload: { roomId: string }) => {
      // Only the acting player may end their turn.
      if (player.name !== room.turnState.player) return fail('Not your turn');
      const block = pendingBlock(room, player.name, 'endTurn');
      if (block) return fail(block);
      // Setup cannot be skipped: the current player must place both a
      // settlement and a road before their setup turn may end.
      if (
        room.turnState.phase === 'SetUp' &&
        (!room.turnState.placedSettlement || !room.turnState.placedRoad)
      ) {
        return fail('Place a settlement and a road before ending setup');
      }
      // The Dice phase advances automatically once both dice are rolled —
      // or, on a 7, once the robber has been moved and the steal resolved.
      if (room.turnState.phase === 'Dice') {
        return fail(
          room.robberMove?.reason === 'seven'
            ? 'Move the robber before ending the Dice phase'
            : room.steal
              ? 'Resolve the steal before ending the Dice phase'
              : 'Roll both dice to end this phase',
        );
      }
      if (!room.board) return fail('Game board is not available');
      advanceTurn(room);
    },
  },

  // Undo the acting player's most recent action this phase (build or action).
  // Locked out once their turn advances: the log is cleared on every
  // `advanceTurn`, and the phase must match the entry kind.
  undoBuild: {
    run: (room: GameRoom, player: Player, _payload: { roomId: string }) => {
      // Only the acting player may undo, and never mid-battle (an undo could
      // teleport a soldier that's committed to an in-progress fight).
      if (player.name !== room.turnState.player) {
        return fail('Only the acting player can undo');
      }
      if (room.battleState) return fail('A battle is in progress');
      const board = room.board;
      if (!board) return fail('Game board is not available');
      const turnState = room.turnState;
      const entry = turnState.undoLog[turnState.undoLog.length - 1];
      if (!entry) return fail('Nothing to undo');
      // Build-phase actions undo only during Build; action-phase actions only
      // during Action. A mismatch means the acting player's turn has ended.
      const isBuildEntry =
        entry.kind === 'buildSettlement' || entry.kind === 'buildRoad' || entry.kind === 'upgradeCity';
      if (turnState.phase !== (isBuildEntry ? 'Build' : 'Action')) {
        return fail('Cannot undo after the turn has ended');
      }
      const actingPlayer = room.players.find((p) => p.name === turnState.player);
      if (!actingPlayer) return fail('Acting player not found');

      // Pop the entry, then reverse its effects.
      turnState.undoLog.pop();
      switch (entry.kind) {
        case 'buildSettlement': {
          if (entry.paid) actingPlayer.resources = addPrice(actingPlayer.resources, SettlementPrice);
          delete board.settlements[entry.settlementId];
          const vertex = board.vertices[entry.vertexId];
          if (vertex && vertex.settlementId === entry.settlementId) vertex.settlementId = null;
          delete board.soldiers[entry.soldierId];
          removeSoldierTracking(turnState, entry.soldierId);
          break;
        }
        case 'buildRoad': {
          if (entry.usedFreeRoad) actingPlayer.freeRoadsLeft += 1;
          else if (entry.paid) actingPlayer.resources = addPrice(actingPlayer.resources, RoadPrice);
          delete board.roads[entry.roadId];
          const edge = board.edges[entry.edgeId];
          if (edge && edge.roadId === entry.roadId) edge.roadId = null;
          for (const vid of [edge?.vertexAId, edge?.vertexBId]) {
            const v = vid ? board.vertices[vid] : undefined;
            if (v) v.roadIds = v.roadIds.filter((id) => id !== entry.edgeId);
          }
          break;
        }
        case 'upgradeCity': {
          actingPlayer.resources = addPrice(actingPlayer.resources, CityPrice);
          const settlement = board.settlements[entry.settlementId];
          if (settlement) settlement.level = 'settlement';
          delete board.soldiers[entry.soldierId];
          removeSoldierTracking(turnState, entry.soldierId);
          break;
        }
        case 'recruitSoldier': {
          actingPlayer.resources = addPrice(actingPlayer.resources, SoldierPrice);
          delete board.soldiers[entry.soldierId];
          removeSoldierTracking(turnState, entry.soldierId);
          break;
        }
        case 'moveSoldier': {
          const soldier = board.soldiers[entry.soldierId];
          if (soldier) soldier.vertexId = entry.originalVertexId;
          // Refund the action so the soldier can move/attack again this phase.
          turnState.soldiersActedThisTurn = turnState.soldiersActedThisTurn.filter(
            (id) => id !== entry.soldierId,
          );
          break;
        }
        case 'captureSettlement': {
          const settlement = board.settlements[entry.settlementId];
          if (settlement) settlement.ownerId = entry.originalOwnerId;
          // Restore the roads that transferred to the capturer.
          for (const t of entry.roadTransfers ?? []) {
            const road = board.roads[t.roadId];
            if (road) road.ownerId = t.originalOwnerId;
          }
          // Refund the action so the capturing soldier can act again this phase.
          turnState.soldiersActedThisTurn = turnState.soldiersActedThisTurn.filter(
            (x) => x !== entry.soldierId,
          );
          break;
        }
      }
    },
  },

  // Place the robber. Mandatory after a 7 roll and after a played knight
  // card. After a 7, the thief chooses which card to steal from a face-down
  // card of an adjacent player (the `chooseSteal` event) and the Dice phase
  // holds until the steal resolves. A knight only moves the robber — no steal.
  moveRobber: {
    run: (room: GameRoom, player: Player, { hexId }: { roomId: string; hexId: string }) => {
      const board = room.board;
      if (!board) return fail('Game board is not available');
      // Only the player with a pending robber move may place it.
      if (!room.robberMove || room.robberMove.player !== player.name) {
        return fail('You have no pending robber move');
      }
      // A 7 requires every discard to be resolved before the robber moves.
      const block = pendingBlock(room, player.name, 'moveRobber');
      if (block) return fail(block);
      const check = canPlaceRobberOn(board, hexId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot place the robber there');

      const reason = room.robberMove.reason;
      placeRobber(board, hexId);
      room.robberMove = null;

      if (reason === 'knight') {
        // A knight only moves the robber: consume the card, no steal.
        const cardIndex = player.developmentCards.indexOf('knight');
        if (cardIndex !== -1) player.developmentCards.splice(cardIndex, 1);
      } else {
        // A 7: steal from an eligible victim (adjacent to the hex, ≥ 1 card)
        // before the Dice phase completes; with none, it completes now.
        const adjacent = playersAdjacentToHex(board, hexId, player.name);
        const victims = eligibleVictims(room.players, adjacent);
        if (victims.length > 0) room.steal = { thief: player.name, victims };
        else advanceTurn(room);
      }
    },
  },

  // Resolve a pending 7-steal: the thief takes the face-down card at
  // `cardIndex` from `victimName`, which completes the Dice phase.
  chooseSteal: {
    run: (
      room: GameRoom,
      player: Player,
      { victimName, cardIndex }: { roomId: string; victimName: string; cardIndex: number },
    ) => {
      if (!room.steal || room.steal.thief !== player.name) {
        return fail('You have no pending steal');
      }
      if (!room.steal.victims.includes(victimName)) {
        return fail('That player is not a valid steal target');
      }
      const victim = room.players.find((p) => p.name === victimName);
      if (!victim) return fail('Steal target not found');
      if (!Number.isInteger(cardIndex)) return fail('Invalid card selection');
      const stolen = stealCard(player, victim, cardIndex);
      if (!stolen) return fail('Invalid card selection');
      room.steal = null;
      advanceTurn(room);
    },
  },

  // Resolve a pending 7-discard: the player hands in exactly `required`
  // resource cards (the floor of half their hand), choosing which ones.
  resolveDiscard: {
    run: (
      room: GameRoom,
      player: Player,
      { discards }: { roomId: string; discards: Record<string, number> },
    ) => {
      const storedRequired = room.discards[player.name];
      if (storedRequired === undefined) return fail('You have no pending discard');
      // If the player traded cards away after the 7, the original requirement
      // could exceed half their current hand; cap it so a legal resolution
      // stays possible (otherwise the Dice phase could wedge forever).
      const handTotal = RESOURCES.reduce((sum, r) => sum + player.resources[r], 0);
      const required = Math.min(storedRequired, Math.floor(handTotal / 2));
      let total = 0;
      for (const r of RESOURCES) {
        const n = Math.floor(discards[r] ?? 0);
        if (n < 0 || n > player.resources[r]) return fail('Invalid discard selection');
        total += n;
      }
      if (total !== required) return fail(`Discard exactly ${required} cards`);
      for (const r of RESOURCES) {
        const n = Math.floor(discards[r] ?? 0);
        player.resources[r] -= n;
        room.robberBag[r] += n;
      }
      delete room.discards[player.name];
    },
  },
};
