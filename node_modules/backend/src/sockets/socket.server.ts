import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@donation-app/shared-types';

type TypedIOServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

let io: TypedIOServer | null = null;

export function initializeSocket(httpServer: HttpServer): TypedIOServer {
  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      // Tighten this to the exact OBS overlay/frontend origin once deployed —
      // '*' is fine for local dev only.
      origin: process.env.CORS_ORIGIN ?? '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] client connected: ${socket.id} (total: ${io?.engine.clientsCount})`);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

export function getIO(): TypedIOServer {
  if (!io) {
    throw new Error('Socket.io accessed before initialization. Call initializeSocket() in server.ts first.');
  }
  return io;
}