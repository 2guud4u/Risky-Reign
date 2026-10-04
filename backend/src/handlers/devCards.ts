import {
  DevelopmentCardPrice,
  canAfford,
  subtractPrice,
  generateDevelopmentCardDeck,
  applyBonuses,
  canKnightSpawnAt,
  ResourceKey,
  RESOURCES,
} from 'common';
import { gameRooms } from '../store';
import { broadcastRoom } from '../broadcast';
import { HandlerContext, blockIfCannotAct } from './context';

/**
 * Development-card handlers: drawing a card from the shared deck, playing a
 * card from the hand (with per-type effects), resolving a pending
 * Year-of-Plenty / Monopoly choice, and resolving a Knight (move the robber,
 * or spawn a soldier where the player already has one).
 */
export function registerDevCardHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  // Draw a development card from the shared deck. Costs 1 wheat, 1 brick and
  // 1 ore (DevelopmentCardPrice) — the standard Catan price.
  socket.on('drawDevelopmentCard', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    // Development cards can only be bought during the Build phase, on your own turn.
    if (room.turnState.phase !== 'Build') {
      socket.emit('error', { message: 'You can only buy development cards during the Build phase' });
      return;
    }
    if (room.turnState.player !== player.name) {
      socket.emit('error', { message: 'You can only buy development cards on your turn' });
      return;
    }
    // The deck is reshuffled (regenerated) when it is exhausted.
    if (room.devCardDeck.length === 0) {
      room.devCardDeck = generateDevelopmentCardDeck();
    }
    if (!canAfford(player.resources, DevelopmentCardPrice)) {
      socket.emit('error', {
        message: 'Need 1 wheat, 1 brick and 1 ore to buy a development card',
      });
      return;
    }

    // Pay and draw the top card of the deck.
    player.resources = subtractPrice(player.resources, DevelopmentCardPrice);
    const card = room.devCardDeck.pop()!;
    // Victory Point cards are counted immediately (no "play" step).
    if (card === 'victory_point') {
      player.victoryPoints++;
    } else {
      player.developmentCards.push(card);
      // A card bought this turn can't be played until next turn.
      player.devCardsBoughtThisTurn++;
    }

    applyBonuses(room);
    broadcastRoom(io, room);
  });

  /**
   * Play a development card from your hand. Only allowed on your own turn.
   * Effects vary by card type (see Rules.md).
   */
  socket.on('playDevelopmentCard', (data: { roomId: string; cardIndex: number }) => {
    const { roomId, cardIndex } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }
    // Development cards can only be played on your own turn.
    if (room.turnState.player !== player.name) {
      socket.emit('error', { message: 'You can only play development cards on your turn' });
      return;
    }
    const card = player.developmentCards[cardIndex];
    if (!card) {
      socket.emit('error', { message: 'Invalid card index' });
      return;
    }
    // A card bought this turn can't be played until next turn: the last
    // `devCardsBoughtThisTurn` cards in the hand are the ones just bought.
    if (cardIndex >= player.developmentCards.length - player.devCardsBoughtThisTurn) {
      socket.emit('error', { message: 'A card bought this turn can only be played next turn' });
      return;
    }
    // A pending robber move (from a 7 or an earlier knight) must be
    // resolved before this player plays another card.
    if (room.robberMove && room.robberMove.player === player.name) {
      socket.emit('error', { message: 'Move the robber before playing another card' });
      return;
    }
    // A pending development-card choice (Year of Plenty / Monopoly) must
    // be resolved before this player plays another card.
    if (room.devCardChoice && room.devCardChoice.player === player.name) {
      socket.emit('error', { message: 'Resolve your card choice before playing another card' });
      return;
    }

    // Knight, Year of Plenty and Monopoly hold their cards until the player
    // makes their choice (the knight's robber branch is consumed by the
    // moveRobber handler; the rest by their resolve handlers); every other
    // card resolves immediately and is removed from the hand now.
    const holdsCard =
      card === 'knight' || card === 'year_of_plenty' || card === 'monopoly';
    if (!holdsCard) {
      player.developmentCards.splice(cardIndex, 1);
    }

    switch (card) {
      case 'knight': {
        // Knight: the player picks an effect — move the robber, or spawn a
        // soldier (see chooseKnightEffect / knightSpawnSoldier).
        if (!room.board) break;
        room.devCardChoice = { player: player.name, card: 'knight', cardIndex };
        break;
      }

      case 'road_building': {
        // Road Building: gain 2 free roads.
        player.freeRoadsLeft += 2;
        break;
      }

      case 'year_of_plenty': {
        // Year of Plenty: the player chooses 2 resources to take from the
        // bank (see the resolveDevCardChoice handler).
        room.devCardChoice = {
          player: player.name,
          card: 'year_of_plenty',
          cardIndex,
        };
        break;
      }

      case 'monopoly': {
        // Monopoly: the player names a resource type; all other players
        // give their cards of that type (see the resolveDevCardChoice
        // handler).
        room.devCardChoice = {
          player: player.name,
          card: 'monopoly',
          cardIndex,
        };
        break;
      }

    }

    applyBonuses(room);
    broadcastRoom(io, room);
  });

  // Resolve a pending development-card choice (Year of Plenty / Monopoly).
  socket.on(
    'resolveDevCardChoice',
    (data: { roomId: string; resources: string[] }) => {
      const { roomId, resources } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (blockIfCannotAct(room, socket)) return;
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }
      if (!room.devCardChoice || room.devCardChoice.player !== player.name || room.devCardChoice.card === 'knight') {
        socket.emit('error', { message: 'No pending card choice' });
        return;
      }
      if (room.devCardChoice.card === 'year_of_plenty') {
        // Year of Plenty: take the 2 chosen resources from the bank.
        if (resources.length !== 2) {
          socket.emit('error', { message: 'Choose exactly 2 resources' });
          return;
        }
        // Validate every pick first (valid resource + enough bank supply),
        // THEN apply — a mid-loop failure must not leave resources granted.
        const demand = new Map<ResourceKey, number>();
        for (const r of resources) {
          if (!RESOURCES.includes(r as ResourceKey)) {
            socket.emit('error', { message: 'Invalid resource' });
            return;
          }
          demand.set(r as ResourceKey, (demand.get(r as ResourceKey) ?? 0) + 1);
        }
        for (const [r, n] of demand) {
          if (room.bankSupply[r] < n) {
            socket.emit('error', { message: `Not enough ${r} in the bank` });
            return;
          }
        }
        for (const r of resources) {
          room.bankSupply[r as ResourceKey]--;
          player.resources[r as ResourceKey]++;
        }
      } else {
        // Monopoly: all other players give their cards of the chosen type.
        if (resources.length !== 1) {
          socket.emit('error', { message: 'Choose exactly 1 resource' });
          return;
        }
        const chosenResource = resources[0] as ResourceKey;
        if (!RESOURCES.includes(chosenResource)) {
          socket.emit('error', { message: 'Invalid resource' });
          return;
        }
        for (const otherPlayer of room.players) {
          if (
            otherPlayer.name !== player.name &&
            otherPlayer.resources[chosenResource] > 0
          ) {
            const amount = otherPlayer.resources[chosenResource];
            otherPlayer.resources[chosenResource] = 0;
            player.resources[chosenResource] += amount;
          }
        }
      }
      // Consume the held card and clear the pending choice.
      player.developmentCards.splice(room.devCardChoice.cardIndex, 1);
      room.devCardChoice = null;
      applyBonuses(room);
      broadcastRoom(io, room);
    }
  );

  // Knight: pick the effect. 'robber' hands off to the moveRobber flow (which
  // consumes the card); 'spawn' waits for knightSpawnSoldier. Re-picking is
  // allowed until the knight resolves (e.g. back out of spawn mode).
  socket.on('chooseKnightEffect', (data: { roomId: string; effect: string }) => {
    const { roomId, effect } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    const player = room.players.find((p) => p.id === socket.id);
    const choice = room.devCardChoice;
    if (!player || !choice || choice.player !== player.name || choice.card !== 'knight') {
      socket.emit('error', { message: 'No pending knight card' });
      return;
    }
    if (effect === 'robber') {
      room.devCardChoice = null;
      room.robberMove = { player: player.name, reason: 'knight' };
    } else if (effect === 'spawn') {
      room.devCardChoice = { ...choice, spawn: true };
    } else {
      socket.emit('error', { message: 'Invalid knight effect' });
      return;
    }
    applyBonuses(room);
    broadcastRoom(io, room);
  });

  // Knight spawn: a free soldier joins a vertex where the player already has
  // a soldier. Like a recruit, it can't move or act this turn (Rule 24).
  socket.on('knightSpawnSoldier', (data: { roomId: string; vertexId: string }) => {
    const { roomId, vertexId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfCannotAct(room, socket)) return;
    const board = room.board;
    const player = room.players.find((p) => p.id === socket.id);
    const choice = room.devCardChoice;
    if (!board || !player || !choice || choice.player !== player.name || choice.card !== 'knight' || !choice.spawn) {
      socket.emit('error', { message: 'No pending knight spawn' });
      return;
    }
    const check = canKnightSpawnAt(board, player.name, vertexId);
    if (!check.allowed) {
      socket.emit('error', { message: check.reason ?? 'Cannot spawn a soldier here' });
      return;
    }
    const soldierId = `soldier_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    board.soldiers[soldierId] = {
      id: soldierId,
      owner: player.name,
      injured: false,
      vertexId,
      type: 'infantry',
      stationed: true,
    };
    room.turnState.soldiersCreatedThisTurn.push(soldierId);
    room.turnState.soldiersActedThisTurn.push(soldierId);
    // Consume the held knight and clear the pending choice.
    player.developmentCards.splice(choice.cardIndex, 1);
    room.devCardChoice = null;
    applyBonuses(room);
    broadcastRoom(io, room);
  });
}
