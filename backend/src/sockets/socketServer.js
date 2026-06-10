const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/appConfig');
const db = require('../database/connection');
const { all } = require('../database/dbUtils');

function setupSockets(server) {
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: false
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const decoded = jwt.verify(token, config.auth.jwtSecret);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    socket.join(`user:${socket.user.id}`);
    const simulations = await all(
      db,
      `SELECT simulation_id FROM simulation_participants
       WHERE user_id = ?`,
      [socket.user.id]
    ).catch(() => []);
    simulations.forEach(({ simulation_id: id }) => socket.join(`simulation:${id}`));
    socket.emit('server:status', { connected: true, timestamp: new Date().toISOString() });
  });

  return io;
}

module.exports = setupSockets;
