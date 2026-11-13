import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      socket.user = jwt.verify(token, config.jwtSecret);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join('store');
  });

  return io;
}

/**
 * Kirim sinyal ke semua client bahwa data berubah.
 * Client cukup me-refresh query yang relevan.
 * @param {'transaction'|'cash'|'product'|'user'} kind
 */
export function emitChange(kind, payload = {}) {
  if (!io) return;
  io.to('store').emit('data:changed', { kind, at: new Date().toISOString(), ...payload });
}
