import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import connectDB from './config/db';
import { setupSocketHandlers } from './sockets';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());
// Serve the built UI (single-origin deployment: page + API + socket on one host).
const uiDist = path.join(__dirname, '../../ui/build');
app.use(express.static(uiDist));
// SPA fallback for any non-socket.io GET (socket.io handles its own path).
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(uiDist, 'index.html'));
});

// Wire up all socket event handlers (see sockets.ts).
setupSocketHandlers(io);

// connectDB() — wire up persistent storage once the DB schema is ready.
void connectDB;

const PORT = process.env.PORT || 3001;
console.log('Server is starting...');
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
