const { Server } = require('socket.io');

function setupSockets(server) {
  const io = new Server(server, {
    cors: {
      origin: "*", // development only
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    // Emit initial status
    socket.emit('server:status', {
      connected: true,
      timestamp: new Date().toISOString()
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
}

module.exports = setupSockets;
