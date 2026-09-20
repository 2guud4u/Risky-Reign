import { PLAYER_COLORS, Player, applyBonuses, MAX_PLAYERS, MIN_PLAYERS } from 'common';

import { createGameRoom, createBoard, gameRooms, resetRoom, freshResourceCount } from '../store';
import { HandlerContext } from './context';

/**
 * Room-lifecycle handlers: joining (with color assignment and the nested
 * color-update handler), regenerating the map, starting the game, making a
 * move, resetting, and disconnect.
 */
export function registerRoomHandlers(ctx: HandlerContext): void {
  const { io, socket } = ctx;

  // Handle room joining.
  socket.on('joinRoom', (data: { roomId: string; playerName: string; color?: string }) => {
    const { roomId, playerName, color } = data;
    let room = gameRooms.get(roomId);
    if (!room) {
      room = createGameRoom(roomId, playerName);
    }
    if (room.players.length >= MAX_PLAYERS) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }
    // If the player is already in the room (reconnect / reload), just re-attach.
    const existing = room.players.find((p) => p.name === playerName);
    if (existing) {
      // Re-attach: the player's id IS their socket id, so a reload (new
      // socket) must re-point it, or the client's syncCurrentPlayer (which
      // matches p.id === socket.id) fails and the session is cleared.
      existing.id = socket.id;
      socket.join(roomId);
      applyBonuses(room);
      io.to(roomId).emit('roomUpdate', room);
      return;
    }
    // Assign a color: the requested one if free, otherwise the first available.
    const used = new Set(room.players.map((p) => p.color));
    let assigned = color;
    if (!assigned || used.has(assigned)) {
      assigned = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
    }
    const player: Player = {
      id: socket.id,
      name: playerName,
      color: assigned,
      resources: freshResourceCount(10),
      victoryPoints: 0,
      developmentCards: [],
      freeRoadsLeft: 0,
      devCardsBoughtThisTurn: 0,
      bankTradesThisTurn: freshResourceCount(0),
    };

    room.players.push(player);
    room.turnState.playerOrder = room.players.map((p) => p.name);
    socket.join(roomId);

    // Send updated room state to all players.
    applyBonuses(room);
    io.to(roomId).emit('roomUpdate', room);

    // Allow the player to change their color while still in the lobby.
    socket.on('updatePlayerColor', (cData: { color: string }) => {
      const p = room.players.find((pl) => pl.id === socket.id);
      if (!p) return;
      const requested = cData.color;
      const taken = new Set(
        room.players.filter((pl) => pl.id !== socket.id).map((pl) => pl.color)
      );
      p.color = !taken.has(requested) ? requested : PLAYER_COLORS.find((c) => !taken.has(c)) ?? p.color;
      io.to(roomId).emit('roomUpdate', room);
    });
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
    if (room.players.length < MIN_PLAYERS) {
      socket.emit('error', { message: `Need at least ${MIN_PLAYERS} players to start` });
      return;
    }
    room.gameStatus = 'playing';
    applyBonuses(room);
    io.to(roomId).emit('roomUpdate', room);
  });

  // Reset game.
  socket.on('resetGame', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    resetRoom(room);
    // "Play Again" returns the room to the lobby (waiting room).
    room.gameStatus = 'waiting';
    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', room);
  });

  // A player leaves the game: remove them from the room and the turn order.
  // If they were the current player, pass the turn to the next player (or to
  // the sentinel 'X' if the room is now empty).
  socket.on('leaveGame', (data: { roomId: string }) => {
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
    const leavingName = player.name;
    const orderIndex = room.turnState.playerOrder.indexOf(leavingName);
    room.players = room.players.filter((p) => p.id !== socket.id);
    room.turnState.playerOrder = room.turnState.playerOrder.filter((n) => n !== leavingName);
    if (room.turnState.player === leavingName) {
      room.turnState.player =
        room.turnState.playerOrder.length > 0
          ? room.turnState.playerOrder[orderIndex % room.turnState.playerOrder.length]
          : 'X';
    }
    socket.leave(roomId);
    applyBonuses(room);
    io.to(roomId).emit('gameUpdate', { ...room });
  });

  // Handle disconnect.
  socket.on('disconnect', () => {
    // Keep the player in the room so a reload / reconnect can re-attach.
    // The room and game state are intentionally NOT reset on disconnect.
  });
}
