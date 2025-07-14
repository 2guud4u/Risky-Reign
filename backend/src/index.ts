// import { getHexagonCoords, createCoordsMapAndTokenMap } from '../../archive/Game';
// import { addPlayer } from '../../archive/Controller/Game';
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

import { GameRoom, Player, generateGameBoard, getRollMap, Board } from 'common';

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

// Store active games
const gameRooms = new Map<string, GameRoom>();
const hexSize = 100;
const boardRadius = 2;
const intersectSize = hexSize / 4;
const roadSize = intersectSize / 2;
// Create a new game room
function createBoard(): Board {
  let {hexes, intersections}  = generateGameBoard(boardRadius, hexSize);
  return {
    Hexes: hexes,
    Intersections: intersections,
    Settlements: [],
    Roads: [],
    Soldiers: [],
  };
}

function createGameRoom(roomId: string): GameRoom {
  //create board
  const gameBoard = createBoard();
  const room: GameRoom = {
    id: roomId,
    players: [],
    board: gameBoard,
    turnState: {
      phase:"SetUp",
      player: '',
      playerOrder: [],
      offset: 0
    },
    gameStatus: 'waiting',
    winner: null,
    tradeStates: [],
    roll: ''
  };
  gameRooms.set(roomId, room);
  return room;
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


    const player: Player = {
      id: socket.id,
      name: playerName,
      color: '',
      resources: {
        Wood: 0,
        Brick: 0,
        Sheep: 0,
        Wheat: 0,
        Ore: 0
      }
    };

    room.players.push(player);
    socket.join(roomId);

    // Send updated room state to all players
    io.to(roomId).emit('roomUpdate', room);
    console.log(`Player ${playerName} joined room ${roomId}`);
  });

  socket.on("refreshMap", (data: { roomId: string }) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Regenerate the game board
    room.board = createBoard();
    //save the updated room state
    gameRooms.set(roomId, room);
    // Send updated room state to all players
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
    room.turnState.player = 'X';
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
          room.turnState.player = 'X';
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
console.log("Server is starting...");
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
