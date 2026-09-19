import {
  DevelopmentCardPrice,
  canAfford,
  subtractPrice,
  generateDevelopmentCardDeck,
  applyBonuses,
  ResourceKey,
} from 'common';
import { gameRooms } from '../store';
import { HandlerContext, blockIfFinished } from './context';

/**
 * Development-card handlers: drawing a card from the shared deck, playing a
 * card from the hand (with per-type effects), and resolving a pending
 * Year-of-Plenty / Monopoly choice.
 */
export function registerDevCardHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  // Draw a development card from the shared deck. Costs 1 wheat, 1 brick and
  // 1 ore (DevelopmentCardPrice) — the standard Catan price.
  socket.on('drawDevelopmentCard', (data: { roomId: string; playerId: string }) => {
    const { roomId, playerId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfFinished(room, socket)) return;
    const player = room.players.find((p) => p.id === playerId);
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
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  /**
   * Play a development card from your hand. Only allowed on your own turn.
   * Effects vary by card type (see Rules.md).
   */
  socket.on('playDevelopmentCard', (data: { roomId: string; playerId: string; cardIndex: number }) => {
    const { roomId, playerId, cardIndex } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (blockIfFinished(room, socket)) return;
    const player = room.players.find((p) => p.id === playerId);
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

    // The knight holds its card until the robber is placed (the moveRobber
    // handler consumes it and performs the steal); Year of Plenty and
    // Monopoly hold their cards until the player makes their choice (the
    // resolveDevCardChoice handler consumes them); every other card
    // resolves immediately and is removed from the hand now.
    const holdsCard =
      card === 'knight' || card === 'year_of_plenty' || card === 'monopoly';
    if (!holdsCard) {
      player.developmentCards.splice(cardIndex, 1);
    }

    switch (card) {
      case 'knight': {
        // Knight: the player chooses where to place the robber (see the
        // moveRobber handler, which consumes the card and steals a card
        // from a player adjacent to the chosen hex).
        if (!room.board) break;
        room.robberMove = { player: player.name, reason: 'knight' };
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
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  // Resolve a pending development-card choice (Year of Plenty / Monopoly).
  socket.on(
    'resolveDevCardChoice',
    (data: { roomId: string; playerId: string; resources: string[] }) => {
      const { roomId, playerId, resources } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (blockIfFinished(room, socket)) return;
      const player = room.players.find((p) => p.id === playerId);
      if (!player) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }
      if (!room.devCardChoice || room.devCardChoice.player !== player.name) {
        socket.emit('error', { message: 'No pending card choice' });
        return;
      }
      const validResources: ResourceKey[] = [
        'Wood',
        'Brick',
        'Sheep',
        'Wheat',
        'Ore',
      ];
      if (room.devCardChoice.card === 'year_of_plenty') {
        // Year of Plenty: take the 2 chosen resources from the bank.
        if (resources.length !== 2) {
          socket.emit('error', { message: 'Choose exactly 2 resources' });
          return;
        }
        for (const r of resources) {
          if (!validResources.includes(r as ResourceKey)) {
            socket.emit('error', { message: 'Invalid resource' });
            return;
          }
          if (room.bankSupply[r as ResourceKey] < 1) {
            socket.emit('error', { message: `Not enough ${r} in the bank` });
            return;
          }
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
        if (!validResources.includes(chosenResource)) {
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
      io.to(roomId).emit('gameUpdate', { ...room });
    }
  );
}
