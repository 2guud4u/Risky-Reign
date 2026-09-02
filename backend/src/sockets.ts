import { Server, Socket } from 'socket.io';
import {
  Board,
  BattleState,
  Player,
  PLAYER_COLORS,
  computePayouts,
  rollTotal,
  applyPayouts,
  canBuildSettlementAt,
  canBuildRoadOn,
  canUpgradeSettlementToCity,
  canBuildSoldierAt,
  canPlaceRobberOn,
  placeRobber,
  playersAdjacentToHex,
  eligibleVictims,
  stealCard,
  canMoveSoldierTo,
  canHealSoldierAt,
  HealSoldierPrice,
  canStartBattle,
  createBattleState,
  rollBattleDie,
  allSoldiersRolled,
  canRollBattleDie,
  resolveBattleRoundIfComplete,
  normalizePrice,
  canCreateTradeOffer,
  canAcceptTradeOffer,
  applyTrade,
  subtractPrice,
  SettlementPrice,
  RoadPrice,
  CityPrice,
  SoldierPrice,
  DevelopmentCardPrice,
  canAfford,
  applyBonuses,
} from 'common';
import { gameRooms, createGameRoom, createBoard } from './store';
import { advanceTurn } from './turn';

/**
 * Register all socket event handlers on the server. Handlers share the
 * in-memory `gameRooms` store and delegate turn transitions to `advanceTurn`.
 */
export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    // Join or create a game room.
    socket.on('joinRoom', (data: { roomId: string; playerName: string; color?: string }) => {
      const { roomId, playerName, color } = data;

      let room = gameRooms.get(roomId);
      if (!room) {
        room = createGameRoom(roomId, playerName);
      }

      // Re-attach: if a player with this name already exists (e.g., after a
      // reload), point their socket id at the new connection and keep their
      // existing progress — don't create a duplicate player.
      const existing = room.players.find((p) => p.name === playerName);
      if (existing) {
        existing.id = socket.id;
        if (color) existing.color = color;
        socket.join(roomId);
        applyBonuses(room);
        io.to(roomId).emit('roomUpdate', room);
        console.log(`Player ${playerName} re-attached to room ${roomId}`);
        return;
      }

      // Update this player's color (e.g., from the waiting-room picker).
      socket.on('updatePlayerColor', (data: { roomId: string; color: string }) => {
        const { roomId, color } = data;
        const room = gameRooms.get(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
        const player = room.players.find((p) => p.id === socket.id);
        if (!player) {
          socket.emit('error', { message: 'Player not found in room' });
          return;
        }
        player.color = color;
        applyBonuses(room);
        io.to(roomId).emit('roomUpdate', room);
      });

      // Check if room is full.
      if (room.players.length >= 10) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }

      const player: Player = {
        id: socket.id,
        name: playerName,
        color: color || PLAYER_COLORS[room.players.length % PLAYER_COLORS.length],
        resources: {
          Wood: 10,
          Brick: 10,
          Sheep: 10,
          Wheat: 10,
          Ore: 10,
        },
        developmentCards: [],
        victoryPoints: 0,
        freeRoadsLeft: 0,
      };

      room.players.push(player);
      room.turnState.playerOrder = room.players.map((p) => p.name);
      socket.join(roomId);

      // Send updated room state to all players.
      applyBonuses(room);
      io.to(roomId).emit('roomUpdate', room);
      console.log(`Player ${playerName} joined room ${roomId}`);
    });

    socket.on('refreshMap', (data: { roomId: string }) => {
      const { roomId } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      // Regenerate the game board.
      room.board = createBoard();
      // The new board resets the robber to the desert; drop any pending move.
      room.robberMove = null;
      applyBonuses(room);
      io.to(roomId).emit('roomUpdate', room);
    });

    socket.on('startGame', (data: { roomId: string }) => {
      const { roomId } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      room.gameStatus = 'playing';
      applyBonuses(room);
      io.to(roomId).emit('roomUpdate', room);
    });

    // Handle game moves.
    socket.on('makeMove', (data: { roomId: string; position: number }) => {
      const { roomId } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }
      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', room);
    });

    // Reset game.
    socket.on('resetGame', (data: { roomId: string }) => {
      const { roomId } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      room.turnState.player = 'X';
      room.gameStatus = room.players.length === 2 ? 'playing' : 'waiting';
      room.winner = null;
      room.robberMove = null;
      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', room);
    });

    // Handle disconnect.
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Keep the player in the room so a reload / reconnect can re-attach.
      // The room and game state are intentionally NOT reset on disconnect.
    });

    // Draw a development card from the shared deck. Costs 1 wheat, 1 brick and
    // 1 ore (DevelopmentCardPrice) — the standard Catan price.
    socket.on('drawDevelopmentCard', (data: { roomId: string; playerId: string }) => {
      const { roomId, playerId } = data;
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
      // Development cards can only be bought on your own turn.
      if (room.turnState.player !== player.name) {
        socket.emit('error', { message: 'You can only buy development cards on your turn' });
        return;
      }
      if (room.devCardDeck.length === 0) {
        socket.emit('error', { message: 'No development cards left in the deck' });
        return;
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
      player.developmentCards.push(card);

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

        case 'victory_point': {
          // Victory Point: gain 1 victory point.
          player.victoryPoints++;
          break;
        }
      }

      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    });

    // Handle game logic.
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
      console.log(`Ending turn for player: ${room.turnState.player}`);
      advanceTurn(room);
      // Notify all players in the room about the turn end.
      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', room);
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
      // out resources and advances to the Trade phase automatically.
      if (room.roll.die1 !== null && room.roll.die2 !== null) {
        const total = rollTotal(room.roll.die1, room.roll.die2);
        if (total === 7) {
          room.robberMove = { player: dicePlayer, reason: 'seven' };
          console.log(`Roll ${room.roll.die1}+${room.roll.die2} = 7: ${dicePlayer} must move the robber`);
        } else {
          const payouts = computePayouts(board, total);
          applyPayouts(room.players, payouts);
          console.log(`Roll ${room.roll.die1}+${room.roll.die2} paid out ${payouts.length} resource(s)`);
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
        console.log(
          `${reason === 'knight' ? 'Knight' : 'Roll 7'}: ${player.name} moved the robber to ${hexId}; choosing a card to steal from: ${victims.join(', ')}`
        );
      } else {
        // No eligible victim: a 7 completes the Dice phase; a knight is done.
        if (reason === 'seven') advanceTurn(room);
        console.log(`${reason === 'knight' ? 'Knight' : 'Roll 7'}: ${player.name} moved the robber to ${hexId} (no one to steal from)`);
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
      console.log(`${reason === 'knight' ? 'Knight' : 'Roll 7'}: ${player.name} stole a ${stolen} from ${victimName}`);

      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    });

    socket.on('buildSettlement', (data: { roomId: string; playerId: string; vertexId: string }) => {
      console.log('building settlement');
      const { roomId, playerId, vertexId } = data;
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
      const currentPlayer = room.players.find((p) => p.id === playerId);
      if (!currentPlayer) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }

      // Authoritative rules live in common (shared with the UI).
      const check = canBuildSettlementAt(board, turnState, currentPlayer.name, vertexId, currentPlayer.resources);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot build settlement here' });
        return;
      }
      
      // Deduct resources in Build phase (after setup)
      if (turnState.phase === 'Build') {
        currentPlayer.resources = subtractPrice(currentPlayer.resources, SettlementPrice);
      }
      const vertex = board.vertices[vertexId];
      const newSettlementId = `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      board.settlements[newSettlementId] = {
        id: newSettlementId,
        vertexId,
        ownerId: currentPlayer.name,
        level: 'settlement',
        builtAt: Date.now(),
      };
      vertex.settlementId = newSettlementId;

      // Spawn a default soldier garrisoned on the new settlement.
      const newSoldierId = `soldier_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      board.soldiers[newSoldierId] = {
        id: newSoldierId,
        owner: currentPlayer.name,
        injured: false,
        vertexId,
        type: 'infantry',
        stationed: true,
      };
      // Track so it cannot move/attack this turn (Rule 24).
      turnState.soldiersCreatedThisTurn.push(newSoldierId);
      turnState.soldiersActedThisTurn.push(newSoldierId);

      // Update the game state.
      turnState.placedSettlement = true;

      // In SetUp, auto-advance once both a settlement and a road are placed.
      if (room.turnState.phase === 'SetUp' && room.turnState.placedSettlement && room.turnState.placedRoad) {
        advanceTurn(room);
      }
      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    });

    socket.on('buildRoad', (data: { roomId: string; playerId: string; edgeId: string }) => {
      console.log('building road');
      const { roomId, playerId, edgeId } = data;
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
      const currentPlayer = room.players.find((p) => p.id === playerId);
      if (!currentPlayer) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }

      // Authoritative rules live in common (shared with the UI). A free road
      // from a played Road Building card skips the resource cost.
      const usingFreeRoad = currentPlayer.freeRoadsLeft > 0;
      const check = canBuildRoadOn(
        board,
        turnState,
        currentPlayer.name,
        edgeId,
        usingFreeRoad ? { Wood: 99, Brick: 99, Sheep: 99, Wheat: 99, Ore: 99 } : currentPlayer.resources
      );
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot build road here' });
        return;
      }

      // Deduct resources in Build phase (after setup), unless it's a free road.
      if (usingFreeRoad) {
        currentPlayer.freeRoadsLeft--;
      } else if (turnState.phase === 'Build') {
        currentPlayer.resources = subtractPrice(currentPlayer.resources, RoadPrice);
      }
      const edge = board.edges[edgeId];
      const newRoadId = `r_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      board.roads[newRoadId] = {
        id: newRoadId,
        edgeId,
        ownerId: currentPlayer.name,
        builtAt: Date.now(),
      };
      edge.roadId = newRoadId;
      // The generator already lists every adjacent edge in roadIds; only add
      // if missing so repeated road builds can't create duplicate entries.
      for (const vid of [edge.vertexAId, edge.vertexBId]) {
        const v = board.vertices[vid];
        if (v && !v.roadIds.includes(edgeId)) v.roadIds.push(edgeId);
      }

      turnState.placedRoad = true;

      // In SetUp, auto-advance once both a settlement and a road are placed.
      if (room.turnState.phase === 'SetUp' && room.turnState.placedSettlement && room.turnState.placedRoad) {
        advanceTurn(room);
      }
      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    });

    socket.on('upgradeSettlementToCity', (data: { roomId: string; playerId: string; vertexId: string }) => {
      console.log('upgrading settlement to city');
      const { roomId, playerId, vertexId } = data;
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
      const currentPlayer = room.players.find((p) => p.id === playerId);
      if (!currentPlayer) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }

      // Authoritative rules live in common (shared with the UI).
      const check = canUpgradeSettlementToCity(board, turnState, currentPlayer.name, vertexId, currentPlayer.resources);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot upgrade settlement to city' });
        return;
      }

      // Deduct resources and upgrade the settlement.
      currentPlayer.resources = subtractPrice(currentPlayer.resources, CityPrice);
      const vertex = board.vertices[vertexId];
      if (vertex && vertex.settlementId) {
        const settlement = board.settlements[vertex.settlementId];
        if (settlement) {
          settlement.level = 'city';
        }
      }

      // Spawn an additional soldier garrisoned on the upgraded city.
      const newSoldierId = `soldier_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      board.soldiers[newSoldierId] = {
        id: newSoldierId,
        owner: currentPlayer.name,
        injured: false,
        vertexId,
        type: 'infantry',
        stationed: true,
      };
      // Track so it cannot move/attack this turn (Rule 24).
      turnState.soldiersCreatedThisTurn.push(newSoldierId);
      turnState.soldiersActedThisTurn.push(newSoldierId);

      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    });

    socket.on('buildSoldier', (data: { roomId: string; playerId: string; vertexId: string }) => {
      console.log('building soldier');
      const { roomId, playerId, vertexId } = data;
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
      const currentPlayer = room.players.find((p) => p.id === playerId);
      if (!currentPlayer) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }

      // Authoritative rules live in common (shared with the UI).
      const check = canBuildSoldierAt(board, turnState, currentPlayer.name, vertexId, currentPlayer.resources);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot build soldier here' });
        return;
      }

      // Deduct resources and garrison the soldier on the settlement.
      currentPlayer.resources = subtractPrice(currentPlayer.resources, SoldierPrice);
      const newSoldierId = `soldier_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      board.soldiers[newSoldierId] = {
        id: newSoldierId,
        owner: currentPlayer.name,
        injured: false,
        vertexId,
        type: 'infantry',
        stationed: true,
      };

      // Track this soldier so it cannot move/attack this turn (Rules.md line 24).
      turnState.soldiersCreatedThisTurn.push(newSoldierId);

      // A freshly built soldier has used its action for this phase.
      turnState.soldiersActedThisTurn.push(newSoldierId);

      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    });

    socket.on('moveSoldier', (data: { roomId: string; playerId: string; soldierId: string; targetVertexId: string }) => {
      console.log('moving soldier');
      const { roomId, playerId, soldierId, targetVertexId } = data;
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
      const currentPlayer = room.players.find((p) => p.id === playerId);
      if (!currentPlayer) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }

      // Authoritative rules live in common (shared with the UI).
      const check = canMoveSoldierTo(board, turnState, currentPlayer.name, soldierId, targetVertexId);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot move soldier there' });
        return;
      }

      // Move the soldier to the new vertex.
      const soldier = board.soldiers[soldierId];
      if (soldier) {
        soldier.vertexId = targetVertexId;
      }

      // Each soldier gets one action per Action phase (Rules.md line 30).
      turnState.soldiersActedThisTurn.push(soldierId);

      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    });

    socket.on('healSoldier', (data: { roomId: string; playerId: string; soldierId: string }) => {
      const { roomId, playerId, soldierId } = data;
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
      const currentPlayer = room.players.find((p) => p.id === playerId);
      if (!currentPlayer) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }

      // Authoritative rules live in common (shared with the UI).
      const check = canHealSoldierAt(board, turnState, currentPlayer.name, soldierId, currentPlayer.resources);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot heal this soldier' });
        return;
      }

      // Deduct healing cost and restore the soldier (Rules.md line 27).
      currentPlayer.resources = subtractPrice(currentPlayer.resources, HealSoldierPrice);
      const soldier = board.soldiers[soldierId];
      if (soldier) {
        soldier.injured = false;
      }

      // Track this soldier so it cannot move this turn (Rules.md line 25).
      turnState.soldiersHealedThisTurn.push(soldierId);

      // Healing consumes the soldier's action for this phase.
      turnState.soldiersActedThisTurn.push(soldierId);

      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    });

    socket.on(
      'startAttack',
      (data: { roomId: string; playerId: string; soldierIds: string[]; targetVertexId: string }) => {
        const { roomId, playerId, soldierIds, targetVertexId } = data;
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
        const currentPlayer = room.players.find((p) => p.id === playerId);
        if (!currentPlayer) {
          socket.emit('error', { message: 'Player not found' });
          return;
        }

        // A battle is already in progress in this room.
        if (room.battleState) {
          socket.emit('error', { message: 'A battle is already in progress' });
          return;
        }

        const check = canStartBattle(room, currentPlayer.name, soldierIds, targetVertexId);
        if (!check.allowed) {
          socket.emit('error', { message: check.reason ?? 'Cannot start this attack' });
          return;
        }

        // Begin the battle. The players roll their own dice in the battle
        // window (one die per soldier); the server only resolves a round once
        // every committed soldier has rolled.
        room.battleState = createBattleState(room, currentPlayer.name, soldierIds, targetVertexId);

        // Attacking consumes each committed soldier's action for this phase.
        for (const id of soldierIds) {
          if (!turnState.soldiersActedThisTurn.includes(id)) {
            turnState.soldiersActedThisTurn.push(id);
          }
        }

        io.to(roomId).emit('gameUpdate', { ...room });
      }
    );

    // A player rolls one battle die for one of their committed soldiers.
    socket.on('rollBattleDie', (data: { roomId: string; playerId: string; soldierId: string }) => {
      const { roomId, playerId, soldierId } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
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

      const battle = room.battleState;
      if (!canRollBattleDie(battle, currentPlayer.name, soldierId)) {
        socket.emit('error', { message: 'You cannot roll that die' });
        return;
      }

      // The player rolls a single die for one of their soldiers.
      rollBattleDie(battle, currentPlayer.name, soldierId);

      // Once every committed soldier has rolled, resolve the round. Casualties
      // are recorded in the battle state only; the board is left untouched and
      // the battle is NOT advanced past the round until the attacker clicks
      // "continue battle" (see the continueBattle handler), so the circles
      // stay intact until then.
      if (allSoldiersRolled(battle)) {
        room.battleState = resolveBattleRoundIfComplete(battle).updatedBattleState;
      }

      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    });

    /**
     * Apply a resolved round's casualties to the board (dead removed, injured
     * flagged) and build the injuredSettled map for repositioning. Shared by
     * continueBattle / endBattle so both commit the outcome identically.
     */
    const applyRoundCasualties = (board: Board, battleState: BattleState): Record<string, string> => {
      for (const side of Object.values(battleState.states)) {
        for (const s of side.soldiers) {
          if (s.dead) {
            delete board.soldiers[s.soldier.id];
          } else if (s.injured && board.soldiers[s.soldier.id]) {
            board.soldiers[s.soldier.id].injured = true;
          }
        }
      }
      const injuredSettled: Record<string, string> = {};
      for (const side of Object.values(battleState.states)) {
        for (const s of side.soldiers) {
          if (!s.dead && s.injured) injuredSettled[s.soldier.id] = s.soldier.vertexId;
        }
      }
      return injuredSettled;
    };

    // The attacker drives the battle forward: roll another round while both
    // sides still have troops. (Ending early is done via 'endBattle'.)
    socket.on(
      'continueBattle',
      (data: { roomId: string; playerId: string }) => {
        const { roomId, playerId } = data;
        const room = gameRooms.get(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
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
      }
    );

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

    // ---- Trade offers (draft anytime; accept only on your turn) ----

    socket.on(
      'createTradeOffer',
      (data: { roomId: string; to: string; give?: unknown; want?: unknown }) => {
        const { roomId, to } = data;
        const room = gameRooms.get(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
        const sender = room.players.find((p) => p.id === socket.id);
        if (!sender) {
          socket.emit('error', { message: 'Player not found in room' });
          return;
        }
        const give = normalizePrice(data.give);
        const want = normalizePrice(data.want);
        const check = canCreateTradeOffer(room, sender.name, to, give, want);
        if (!check.allowed) {
          socket.emit('error', { message: check.reason ?? 'Cannot create this trade offer' });
          return;
        }
        room.tradeOffers.push({
          id: `t_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          from: sender.name,
          to,
          give,
          want,
          status: 'pending',
        });
        applyBonuses(room);
        io.to(roomId).emit('gameUpdate', { ...room });
      }
    );

    socket.on('acceptTrade', (data: { roomId: string; tradeId: string }) => {
      const { roomId, tradeId } = data;
      const room = gameRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      const acceptor = room.players.find((p) => p.id === socket.id);
      if (!acceptor) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }
      const offer = room.tradeOffers.find((o) => o.id === tradeId);
      if (!offer) {
        socket.emit('error', { message: 'Trade offer not found' });
        return;
      }
      const check = canAcceptTradeOffer(room, offer, acceptor.name);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot accept this trade' });
        return;
      }
      applyTrade(room, offer);
      offer.status = 'accepted';
      applyBonuses(room);
      io.to(roomId).emit('gameUpdate', { ...room });
    });

    socket.on('declineTrade', (data: { roomId: string; tradeId: string }) => {
      const { roomId, tradeId } = data;
      const room = gameRooms.get(roomId);
      if (!room) return;
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;
      const offer = room.tradeOffers.find((o) => o.id === tradeId);
      // Only the recipient may decline, and only while pending.
      if (offer && offer.to === player.name && offer.status === 'pending') {
        offer.status = 'declined';
        applyBonuses(room);
        io.to(roomId).emit('gameUpdate', { ...room });
      }
    });

    socket.on('cancelTrade', (data: { roomId: string; tradeId: string }) => {
      const { roomId, tradeId } = data;
      const room = gameRooms.get(roomId);
      if (!room) return;
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;
      const offer = room.tradeOffers.find((o) => o.id === tradeId);
      // Only the creator may cancel, and only while pending.
      if (offer && offer.from === player.name && offer.status === 'pending') {
        offer.status = 'cancelled';
        applyBonuses(room);
        io.to(roomId).emit('gameUpdate', { ...room });
      }
    });
  });
}
