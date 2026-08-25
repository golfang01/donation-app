import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@donation-app/shared-types';

type TypedIOServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

let io: TypedIOServer | null = null;

export function initializeSocket(httpServer: HttpServer): TypedIOServer {
  const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:4000');
}
  io = new SocketIOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // Desktop donation form calls this immediately after connecting,
    // so the backend knows which socket to notify when the mobile slip arrives.
    socket.on('join:session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      console.log(`[socket] ${socket.id} joined room session:${sessionId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

export function getIO(): TypedIOServer {
  if (!io) throw new Error('Socket.io not initialized. Call initializeSocket() first.');
  return io;
}