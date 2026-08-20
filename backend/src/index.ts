import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import connectDB from './config/db';
import { setupSocketHandlers } from './sockets';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Wire up all socket event handlers (see sockets.ts).
setupSocketHandlers(io);

// connectDB() — wire up persistent storage once the DB schema is ready.
void connectDB;

const PORT = process.env.PORT || 3001;
console.log('Server is starting...');
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
