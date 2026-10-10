import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from 'common';
import cors from 'cors';
import path from 'path';
import { setupSocketHandlers } from './sockets';
import { startRoomSweep } from './roomSweep';

const app = express();
const server = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
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
startRoomSweep(io);
// Last-resort guards: a handler throwing through the socket wrapper (or any
// stray async rejection) must not take the process down. Log and keep serving.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (kept alive):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (kept alive):', reason);
});
const PORT = process.env.PORT || 3001;
console.log('Server is starting...');
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
