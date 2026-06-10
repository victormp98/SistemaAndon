const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/appConfig');
const db = require('../database/connection');
const { all, get } = require('../database/dbUtils');

function setupSockets(server) {
  const io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
          || /^https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)) {
          return callback(null, true);
        }
        callback(new Error('origin not allowed'));
      },
      credentials: false
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const decoded = jwt.verify(token, config.auth.jwtSecret);
      const user = await get(
        db,
        `SELECT u.id, u.user_type, u.is_admin FROM users u
         JOIN auth_sessions s ON s.user_id = u.id AND s.id = ?
         WHERE u.id = ? AND u.is_active = 1 AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP`,
        [decoded.jti, decoded.id]
      );
      if (!user) return next(new Error('unauthorized'));
      socket.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    socket.join(`user:${socket.user.id}`);
    const simulations = socket.user.user_type === 'professor'
      ? await all(
        db,
        `SELECT id AS simulation_id FROM simulations
         WHERE ? = 1 OR created_by_user_id = ?`,
        [socket.user.is_admin, socket.user.id]
      ).catch(() => [])
      : await all(
        db,
        'SELECT simulation_id FROM simulation_participants WHERE user_id = ?',
        [socket.user.id]
      ).catch(() => []);
    simulations.forEach(({ simulation_id: id }) => socket.join(`simulation:${id}`));
    socket.emit('server:status', { connected: true, timestamp: new Date().toISOString() });
  });

  io.clientCount = () => io.engine.clientsCount;
  return io;
}

module.exports = setupSockets;
