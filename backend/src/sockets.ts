import { Server, Socket } from 'socket.io';
import {
  Player,
  PLAYER_COLORS,
  computePayouts,
  rollTotal,
  applyPayouts,
  canBuildSettlementAt,
  canBuildRoadOn,
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
          Wood: 100,
          Brick: 100,
          Sheep: 100,
          Wheat: 100,
          Ore: 100,
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

      // When both dice are in, pass out resources for the total.
      if (room.roll.die1 !== null && room.roll.die2 !== null) {
        const payouts = computePayouts(board, rollTotal(room.roll.die1, room.roll.die2));
        applyPayouts(room.players, payouts);
        console.log(`Roll ${room.roll.die1}+${room.roll.die2} paid out ${payouts.length} resource(s)`);
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
      const check = canBuildSettlementAt(board, turnState, currentPlayer.name, vertexId);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot build settlement here' });
        return;
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
      const check = canBuildRoadOn(board, turnState, currentPlayer.name, edgeId);
      if (!check.allowed) {
        socket.emit('error', { message: check.reason ?? 'Cannot build road here' });
        return;
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
      io.to(roomId).emit('gameUpdate', { ...room });
    });
  });
}
