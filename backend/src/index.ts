import { getHexagonCoords, createCoordsMapAndTokenMap } from './Services/Game';
import { addPlayer } from './Controller/Game';
import connectDB from './config/db';
import http from 'http';

// import SocketSetup from './Socket/index';
// const app = express();

// const server = createServer(app);
// const io = new Server(server, {
//   cors: { origin : 'http://localhost:3000',}
// });

// // connectDB();
// SocketSetup(io);



// server.listen(5000, () => {
//   console.log('server running at http://localhost:5000');
// });

// io.to('some room').emit('some event'); sends to all users in 'some room'

// socket.emit('some event'); sends to the unique socket connected to the server
// socket.to('some room').emit('some event'); sends to all users in 'some room' except the sender
// server.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Game state interfaces
interface Player {
  id: string;
  name: string;
  symbol: 'X' | 'O';
}

interface GameRoom {
  id: string;
  players: Player[];
  board: (string | null)[];
  currentPlayer: 'X' | 'O';
  gameStatus: 'waiting' | 'playing' | 'finished';
  winner: string | null;
}

// Store active games
const gameRooms = new Map<string, GameRoom>();

// Create a new game room
function createGameRoom(roomId: string): GameRoom {
  const room: GameRoom = {
    id: roomId,
    players: [],
    board: Array(9).fill(null),
    currentPlayer: 'X',
    gameStatus: 'waiting',
    winner: null
  };
  gameRooms.set(roomId, room);
  return room;
}

// Check for winner
function checkWinner(board: (string | null)[]): string | null {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
}

// Check for draw
function checkDraw(board: (string | null)[]): boolean {
  return board.every(cell => cell !== null);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join or create a game room
  socket.on('joinRoom', (data: { roomId: string; playerName: string }) => {
    const { roomId, playerName } = data;
    
    let room = gameRooms.get(roomId);
    if (!room) {
      room = createGameRoom(roomId);
    }

    // Check if room is full
    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    // Add player to room
    const symbol: 'X' | 'O' = room.players.length === 0 ? 'X' : 'O';
    const player: Player = {
      id: socket.id,
      name: playerName,
      symbol
    };

    room.players.push(player);
    socket.join(roomId);

    // Start game if we have 2 players
    if (room.players.length === 2) {
      room.gameStatus = 'playing';
    }

    // Send updated room state to all players
    io.to(roomId).emit('roomUpdate', room);
    
    console.log(`Player ${playerName} joined room ${roomId}`);
  });

  // Handle game moves
  socket.on('makeMove', (data: { roomId: string; position: number }) => {
    const { roomId, position } = data;
    const room = gameRooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Find the player making the move
    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not found in room' });
      return;
    }

    // Validate move
    if (room.gameStatus !== 'playing') {
      socket.emit('error', { message: 'Game is not active' });
      return;
    }

    if (player.symbol !== room.currentPlayer) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    if (room.board[position] !== null) {
      socket.emit('error', { message: 'Position already taken' });
      return;
    }

    // Make the move
    room.board[position] = player.symbol;

    // Check for winner
    const winner = checkWinner(room.board);
    if (winner) {
      room.gameStatus = 'finished';
      room.winner = player.name;
    } else if (checkDraw(room.board)) {
      room.gameStatus = 'finished';
      room.winner = 'draw';
    } else {
      // Switch turns
      room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
    }

    // Send updated game state to all players in room
    io.to(roomId).emit('gameUpdate', room);
  });

  // Reset game
  socket.on('resetGame', (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Reset game state
    room.board = Array(9).fill(null);
    room.currentPlayer = 'X';
    room.gameStatus = room.players.length === 2 ? 'playing' : 'waiting';
    room.winner = null;

    // Send updated game state
    io.to(roomId).emit('gameUpdate', room);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Remove player from all rooms
    for (const [roomId, room] of gameRooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        // If room is empty, delete it
        if (room.players.length === 0) {
          gameRooms.delete(roomId);
        } else {
          // Reset game if a player leaves
          room.board = Array(9).fill(null);
          room.currentPlayer = 'X';
          room.gameStatus = 'waiting';
          room.winner = null;
          
          // Notify remaining players
          io.to(roomId).emit('roomUpdate', room);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
