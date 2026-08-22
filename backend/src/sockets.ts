import { Server, Socket } from 'socket.io';
import {
  Player,
  PLAYER_COLORS,
  computePayouts,
  rollTotal,
  applyPayouts,
  canBuildSettlementAt,
  canBuildRoadOn,
  canUpgradeSettlementToCity,
  canBuildSoldierAt,
  canMoveSoldierTo,
  normalizePrice,
  canCreateTradeOffer,
  canAcceptTradeOffer,
  applyTrade,
  subtractPrice,
  SettlementPrice,
  RoadPrice,
  CityPrice,
  SoldierPrice,
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
      };

      room.players.push(player);
      room.turnState.playerOrder = room.players.map((p) => p.name);
      socket.join(roomId);

      // Send updated room state to all players.
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
      io.to(roomId).emit('gameUpdate', room);
    });

    // Handle disconnect.
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Keep the player in the room so a reload / reconnect can re-attach.
      // The room and game state are intentionally NOT reset on disconnect.
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
      // The Dice phase advances automatically once both dice are rolled.
      if (room.turnState.phase === 'Dice') {
        socket.emit('error', { message: 'Roll both dice to end this phase' });
        return;
      }
      if (!room.board) {
        socket.emit('error', { message: 'Game board is not available' });
        return;
      }
      console.log(`Ending turn for player: ${room.turnState.player}`);
      advanceTurn(room);
      // Notify all players in the room about the turn end.
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

      // One die per click: the first click rolls die 1, the second rolls die 2.
      const roll = room.roll;
      const value = Math.floor(Math.random() * 6) + 1;
      if (roll.die1 === null) {
        room.roll = { die1: value, die2: null };
      } else if (roll.die2 === null) {
        room.roll = { die1: roll.die1, die2: value };
      } else {
        // Both dice already rolled — start a fresh roll.
        room.roll = { die1: value, die2: null };
      }

      // When both dice are in, pass out resources for the total and advance
      // to the Trade phase automatically (no manual end-turn needed).
      if (room.roll.die1 !== null && room.roll.die2 !== null) {
        const payouts = computePayouts(board, rollTotal(room.roll.die1, room.roll.die2));
        applyPayouts(room.players, payouts);
        console.log(`Roll ${room.roll.die1}+${room.roll.die2} paid out ${payouts.length} resource(s)`);
        advanceTurn(room);
      }

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

      // Update the game state.
      turnState.placedSettlement = true;

      // In SetUp, auto-advance once both a settlement and a road are placed.
      if (room.turnState.phase === 'SetUp' && room.turnState.placedSettlement && room.turnState.placedRoad) {
        advanceTurn(room);
      }
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

      // Authoritative rules live in common (shared with the UI).
      const check = canBuildRoadOn(board, turnState, currentPlayer.name, edgeId, currentPlayer.resources);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot build road here' });
        return;
      }
      
      // Deduct resources in Build phase (after setup)
      if (turnState.phase === 'Build') {
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
      board.vertices[edge.vertexAId].roadIds.push(edgeId);
      board.vertices[edge.vertexBId].roadIds.push(edgeId);

      turnState.placedRoad = true;

      // In SetUp, auto-advance once both a settlement and a road are placed.
      if (room.turnState.phase === 'SetUp' && room.turnState.placedSettlement && room.turnState.placedRoad) {
        advanceTurn(room);
      }
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

      io.to(roomId).emit('gameUpdate', { ...room });
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
        io.to(roomId).emit('gameUpdate', { ...room });
      }
    });
  });
}
