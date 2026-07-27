import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/tokens.js';
import { Collaboration } from '../domains/collaboration/collaboration.model.js';

let io;

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function initIO(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL, credentials: true },
  });

  io.use((socket, next) => {
    const token = parseCookie(socket.handshake.headers.cookie, 'accessToken');
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.sub;
      next();
    } catch {
      next(new Error('Invalid or expired access token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);

    socket.on('chat:typing', async ({ collaborationId }) => {
      const collaboration = await Collaboration.findById(collaborationId).select('participants');
      if (!collaboration) return;

      const isParticipant = collaboration.participants.some(
        (p) => p.user.toString() === socket.userId
      );
      if (!isParticipant) return;

      const other = collaboration.participants.find((p) => p.user.toString() !== socket.userId);
      if (other) {
        io.to(`user:${other.user}`).emit('chat:typing', { collaborationId, userId: socket.userId });
      }
    });

    socket.on('disconnect', () => {
      // no-op for now
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.IO has not been initialized yet');
  }
  return io;
}
