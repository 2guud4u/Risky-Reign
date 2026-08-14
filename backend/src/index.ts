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

import { GameRoom, Player, generateGameBoard, getRollMap, Board, SettlementPrice } from 'common';
// TODO: These imports need to be defined
// import { handleRollDice, handleBuildSettlement } from './utils/gameUtils';
// import { changePlayerResources } from './utils/playerUtils';
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

function createGameRoom(roomId: string, firstPlayerName: string): GameRoom {
  //create board
  const gameBoard = createBoard();
  const room: GameRoom = {
    id: roomId,
    players: [],
    board: gameBoard,
    turnState: {
      phase:"SetUp",
      player: firstPlayerName,
      playerOrder: [firstPlayerName],
      offset: 0,
      dicePlayerIndex: 0,
      placedSettlement: false,
      placedRoad: false,
    },
    gameStatus: 'waiting',
    winner: null,
    tradeStates: [],
    battleState: null,
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
      room = createGameRoom(roomId, playerName);
    }

    // Check if room is full
    if (room.players.length >= 10) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }


    const player: Player = {
      id: socket.id,
      name: playerName,
      color: '',
      resources: {
        Wood: 100,
        Brick: 100,
        Sheep: 100,
        Wheat: 100,
        Ore: 100
      }
    };

    room.players.push(player);
    room.turnState.playerOrder = room.players.map(p => p.name);
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

  // Handle Game Logic
socket.on('endTurn', (data: { roomId: string }) => {
  const { roomId } = data;
  let room = gameRooms.get(roomId);
  if (!room) {
    socket.emit('error', { message: 'Room not found' });
    return;
  }
  
  const board = room.board;
  if (!board) {
    socket.emit('error', { message: 'Game board is not available' });
    return;
  }
  
  const playerIndex = room.turnState.playerOrder.indexOf(room.turnState.player);
  const turnState = room.turnState;
  const playerCount = turnState.playerOrder.length;
  
  console.log(`Ending turn for player: ${room.turnState.player}`);
  
  // Initialize dicePlayerIndex if not exists
  if (!turnState.dicePlayerIndex && turnState.dicePlayerIndex !== 0) {
    turnState.dicePlayerIndex = 0;
  }
  
  switch (turnState.phase) {
    case 'SetUp':
      const totalSetupTurns = playerCount * 2; // Each player does setup twice
      
      if (turnState.offset === totalSetupTurns - 1) {
        // Setup complete, start dice phase with first player
        room.turnState = { 
          ...turnState, 
          player: turnState.playerOrder[0],
          phase: 'Dice', 
          offset: 0,
          placedSettlement: null,
          placedRoad: null
        };
        turnState.dicePlayerIndex = 0;
      } else {
        // Determine next player based on setup round
        let nextPlayerIndex;
        const nextOffset = turnState.offset + 1;
        
        if (nextOffset < playerCount) {
          // First round: clockwise (A→B→C)
          nextPlayerIndex = nextOffset;
        } else {
          // Second round: counterclockwise (C→B→A)
          const positionInSecondRound = nextOffset - playerCount;
          nextPlayerIndex = playerCount - 1 - positionInSecondRound;
        }
        
        room.turnState = { 
          ...turnState, 
          player: turnState.playerOrder[nextPlayerIndex], 
          offset: nextOffset,
          placedSettlement: false,
          placedRoad: false
        };
      }
      break;
      
    case 'Dice':
      // Same player continues to Trade phase
      room.turnState = { ...turnState, phase: 'Trade' };
      console.log("Dice rolled, moving to Trade phase");
      break;
      
    case 'Trade':
      // Same player continues to Build phase, reset offset for all players to participate
      room.turnState = { ...turnState, phase: 'Build', offset: 0 };
      break;
      
    case 'Build':
      if (turnState.offset === playerCount - 1) {
        // All players have built, move to Action phase with dice player
        room.turnState = { 
          ...turnState, 
          player: turnState.playerOrder[turnState.dicePlayerIndex], 
          phase: 'Action', 
          offset: 0 
        };
      } else {
        // Next player's turn to build
        const nextPlayerIndex = (playerIndex + 1) % playerCount;
        room.turnState = { 
          ...turnState, 
          player: turnState.playerOrder[nextPlayerIndex], 
          offset: turnState.offset + 1 
        };
      }
      break;
      
    case 'Action':
      if (turnState.offset === playerCount - 1) {
        // All players have acted, move to next player's Dice phase
        turnState.dicePlayerIndex = (turnState.dicePlayerIndex + 1) % playerCount;
        room.turnState = { 
          ...turnState, 
          player: turnState.playerOrder[turnState.dicePlayerIndex], 
          phase: 'Dice', 
          offset: 0 
        };
      } else {
        // Next player's turn for action
        const nextPlayerIndex = (playerIndex + 1) % playerCount;
        room.turnState = { 
          ...turnState, 
          player: turnState.playerOrder[nextPlayerIndex], 
          offset: turnState.offset + 1 
        };
      }
      break;
      
    default:
      socket.emit('error', { message: 'Invalid turn phase' });
      return;
  }
  
  // Notify all players in the room about the turn end
  io.to(roomId).emit('gameUpdate', room);
});

  socket.on('rollDice', (data: { roomId: string}) => {
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
    // Simulate dice roll
    let rollNum = String(Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1);


    // Update roll and notify players
    room.roll = String(rollNum);
    handleRollDice(rollNum, room.players, board.Hexes, board.Intersections, board.Settlements);
    

    
    io.to(roomId).emit('gameUpdate', { ...room});
  })
  socket.on("buildSettlement", (data: { roomId: string, playerId: string, intersectId: number }) => {
    console.log("building settlement");
      const { roomId, playerId, intersectId } = data;
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
      if (turnState.placedSettlement === true) {
        socket.emit('error', { message: 'You have already placed a settlement this turn' });
        return;
      }
      const currentPlayer = room.players.find(p => p.id === playerId);
      if (!currentPlayer) {
        socket.emit('error', { message: 'Player not found' });
        return;
      }
      if (turnState.player !== currentPlayer.name) {
        socket.emit('error', { message: 'It is not your turn' });
        return;
      }
      
      if (turnState.phase === 'SetUp' ) {
        handleBuildSettlement(intersectId, currentPlayer, board.Intersections, board.Settlements, true);
      } else if (turnState.phase == 'Build') {
        handleBuildSettlement(intersectId, currentPlayer, board.Intersections, board.Settlements, false);
        changePlayerResources(currentPlayer, SettlementPrice, room.players);
      }
      else {
        socket.emit('error', { message: 'You can only build settlements during SetUp or Build phase' });
        return;
      }
      // Update the game state
      turnState.placedSettlement = true;
      io.to(roomId).emit('gameUpdate', { ...room });

  })
});



const PORT = process.env.PORT || 3001;
console.log("Server is starting...");
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
