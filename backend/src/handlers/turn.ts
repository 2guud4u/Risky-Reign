import {
  applyBonuses,
  addPrice,
  SettlementPrice,
  RoadPrice,
  CityPrice,
  SoldierPrice,
  rollTotal,
  computePayouts,
  applyPayouts,
  canPlaceRobberOn,
  placeRobber,
  playersAdjacentToHex,
  eligibleVictims,
  stealCard,
  RESOURCES,
  type TurnState,
} from 'common';
import { advanceTurn } from '../turn';
import { gameRooms } from '../store';
import { HandlerContext } from './context';

/**
 * Turn-flow handlers: ending the turn, undoing the most recent action, rolling
 * the dice (with 7-robber and payout resolution), moving the robber, and
 * resolving a steal.
 */
export function registerTurnHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  /** Remove a soldier id from the per-turn tracking arrays (used by undo). */
  const removeSoldierTracking = (turnState: TurnState, soldierId: string): void => {
    turnState.soldiersCreatedThisTurn = turnState.soldiersCreatedThisTurn.filter((id) => id !== soldierId);
    turnState.soldiersActedThisTurn = turnState.soldiersActedThisTurn.filter((id) => id !== soldierId);
  };

  socket.on('endTurn', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    // Setup cannot be skipped: the current player must place both a
    // settlement and a road before their setup turn may end.
    if (
      room.turnState.phase === 'SetUp' &&
      (!room.turnState.placedSettlement || !room.turnState.placedRoad)
    ) {
      socket.emit('error', {
        message: 'Place a settlement and a road before ending setup',
      });
      return;
    }
    // The Dice phase advances automatically once both dice are rolled —
    // or, on a 7, once the robber has been moved and the steal resolved.
    if (room.turnState.phase === 'Dice') {
      socket.emit('error', {
        message:
          room.robberMove?.reason === 'seven'
            ? 'Move the robber before ending the Dice phase'
            : room.steal?.reason === 'seven'
              ? 'Resolve the steal before ending the Dice phase'
              : 'Roll both dice to end this phase',
      });
      return;
    }
    if (!room.board) {
      socket.emit('error', { message: 'Game board is not available' });
      return;
    }
    advanceTurn(room);
    // Notify all players in the room about the turn end.
    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', room);
  });

  // Undo the acting player's most recent action this phase (build or action).
  // Locked out once their turn advances: the log is cleared on every
  // `advanceTurn`, and the phase must match the entry kind.
  socket.on('undoBuild', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const board = room.board;
    if (!board) {
      socket.emit('error', { message: 'Game board is not available' });
      return;
    }
    const turnState = room.turnState;
    const entry = turnState.undoLog[turnState.undoLog.length - 1];
    if (!entry) {
      socket.emit('error', { message: 'Nothing to undo' });
      return;
    }
    // Build-phase actions undo only during Build; action-phase actions only
    // during Action. A mismatch means the acting player's turn has ended.
    const isBuildEntry =
      entry.kind === 'buildSettlement' || entry.kind === 'buildRoad' || entry.kind === 'upgradeCity';
    if (turnState.phase !== (isBuildEntry ? 'Build' : 'Action')) {
      socket.emit('error', { message: 'Cannot undo after the turn has ended' });
      return;
    }
    const actingPlayer = room.players.find((p) => p.name === turnState.player);
    if (!actingPlayer) {
      socket.emit('error', { message: 'Acting player not found' });
      return;
    }

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
        // Refund the actions so the capturing soldiers can act again this phase.
        for (const id of entry.soldierIds) {
          turnState.soldiersActedThisTurn = turnState.soldiersActedThisTurn.filter(
            (x) => x !== id,
          );
        }
        break;
      }
      case 'fightRobber': {
        // Refund the soldier's action and the player's once-per-phase fight.
        turnState.soldiersActedThisTurn = turnState.soldiersActedThisTurn.filter(
          (id) => id !== entry.soldierId,
        );
        turnState.robberFoughtThisPhase = turnState.robberFoughtThisPhase.filter(
          (name) => name !== entry.playerName,
        );
        if (entry.result === 'lose') {
          // Restore the killed soldier.
          board.soldiers[entry.soldierId] = entry.soldierSnapshot;
        } else {
          // Take the bag back and return it to the robber.
          for (const r of RESOURCES) {
            actingPlayer.resources[r] -= entry.bagBefore[r];
          }
          room.robberBag = { ...entry.bagBefore };
        }
        break;
      }
    }

    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  socket.on('rollDice', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const board = room.board;
    if (!board) {
      socket.emit('error', { message: 'Game board is not available' });
      return;
    }
    // Only the dice player may roll, and only during the Dice phase.
    if (room.turnState.phase !== 'Dice') {
      socket.emit('error', { message: 'It is not the Dice phase' });
      return;
    }
    const dicePlayer = room.turnState.player;
    const socketPlayer = room.players.find((p) => p.id === socket.id);
    if (!socketPlayer || socketPlayer.name !== dicePlayer) {
      socket.emit('error', { message: 'It is not your turn to roll' });
      return;
    }

    // A pending 7 (robber move or steal) must be resolved before any
    // further roll.
    if (room.robberMove?.reason === 'seven' || room.steal?.reason === 'seven') {
      socket.emit('error', { message: 'Resolve the 7 before rolling again' });
      return;
    }

    // One die per click: the first click rolls die 1, the second rolls die 2.
    const roll = room.roll;
    const value = Math.floor(Math.random() * 6) + 1;
    if (roll.die1 === null) {
      room.roll = { die1: value, die2: null };
    } else if (roll.die2 === null) {
      room.roll = { die1: roll.die1, die2: value };
    } else {
      socket.emit('error', { message: 'Both dice are already rolled' });
      return;
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
        // robber can be moved.
        const discards: Record<string, number> = {};
        for (const p of room.players) {
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

    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  // Place the robber. Mandatory after a 7 roll and after a played knight
  // card. After the robber is placed, the thief chooses which card to steal
  // from a face-down card of an adjacent player (the `chooseSteal` event);
  // a 7 holds the Dice phase until the steal resolves.
  socket.on('moveRobber', (data: { roomId: string; playerId: string; hexId: string }) => {
    const { roomId, playerId, hexId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const board = room.board;
    if (!board) {
      socket.emit('error', { message: 'Game board is not available' });
      return;
    }
    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    // Only the player with a pending robber move may place it.
    if (!room.robberMove || room.robberMove.player !== player.name) {
      socket.emit('error', { message: 'You have no pending robber move' });
      return;
    }
    // A 7 requires every discard to be resolved before the robber moves.
    if (room.robberMove.reason === 'seven' && Object.keys(room.discards).length > 0) {
      socket.emit('error', { message: 'Resolve the 7 discards before moving the robber' });
      return;
    }
    const check = canPlaceRobberOn(board, hexId);
    if (!check.allowed) {
      socket.emit('error', { message: check.reason ?? 'Cannot place the robber there' });
      return;
    }

    placeRobber(board, hexId);
    const reason = room.robberMove.reason;

    if (reason === 'knight') {
      // Consume the knight card now that the robber is placed.
      const cardIndex = player.developmentCards.indexOf('knight');
      if (cardIndex !== -1) player.developmentCards.splice(cardIndex, 1);
    }

    // Eligible victims: players adjacent to the chosen hex holding ≥ 1 card.
    const adjacent = playersAdjacentToHex(board, hexId, player.name);
    const victims = eligibleVictims(room.players, adjacent);

    if (victims.length > 0) {
      // Enter the steal phase: the thief picks a face-down card from a
      // victim. A 7 holds the Dice phase until the steal resolves.
      room.steal = { thief: player.name, victims, reason };
    } else {
      // No eligible victim: a 7 completes the Dice phase; a knight is done.
      if (reason === 'seven') advanceTurn(room);
    }
    room.robberMove = null;

    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  // Resolve a pending steal: the thief takes the face-down card at
  // `cardIndex` from `victimName`. A 7 completes the Dice phase afterward.
  socket.on('chooseSteal', (data: { roomId: string; playerId: string; victimName: string; cardIndex: number }) => {
    const { roomId, playerId, victimName, cardIndex } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    if (!room.steal || room.steal.thief !== player.name) {
      socket.emit('error', { message: 'You have no pending steal' });
      return;
    }
    if (!room.steal.victims.includes(victimName)) {
      socket.emit('error', { message: 'That player is not a valid steal target' });
      return;
    }
    const victim = room.players.find((p) => p.name === victimName);
    if (!victim) {
      socket.emit('error', { message: 'Steal target not found' });
      return;
    }
    const stolen = stealCard(player, victim, cardIndex);
    if (!stolen) {
      socket.emit('error', { message: 'Invalid card selection' });
      return;
    }
    const reason = room.steal.reason;
    room.steal = null;
    if (reason === 'seven') advanceTurn(room);

    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });
  // Resolve a pending 7-discard: the player hands in exactly `required`
  // resource cards (the floor of half their hand), choosing which ones.
  socket.on(
    'resolveDiscard',
    (data: { roomId: string; playerId: string; discards: Record<string, number> }) => {
      const { roomId, playerId, discards } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      const player = room.players.find((p) => p.id === playerId);
      if (!player) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }
      const required = room.discards[player.name];
      if (required === undefined) {
        socket.emit('error', { message: 'You have no pending discard' });
        return;
      }
      let total = 0;
      for (const r of RESOURCES) {
        const n = Math.floor(discards[r] ?? 0);
        if (n < 0 || n > player.resources[r]) {
          socket.emit('error', { message: 'Invalid discard selection' });
          return;
        }
        total += n;
      }
      if (total !== required) {
        socket.emit('error', { message: `Discard exactly ${required} cards` });
        return;
      }
      for (const r of RESOURCES) {
        const n = Math.floor(discards[r] ?? 0);
        player.resources[r] -= n;
        room.robberBag[r] += n;
      }
      delete room.discards[player.name];
      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    }
  );
}
