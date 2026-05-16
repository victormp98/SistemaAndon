const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const config = require('./config/appConfig');
const healthRoutes = require('./routes/health.routes');
const dbRoutes = require('./routes/db.routes');
const authRoutes = require('./routes/auth.routes');
const setupSockets = require('./sockets/socketServer');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', healthRoutes);
app.use('/api/db', dbRoutes);
app.use('/api/auth', authRoutes);

// Socket.IO
setupSockets(server);

// Start server
const PORT = config.server.port || 3000;
const HOST = config.server.host || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`-------------------------------------------`);
  console.log(`${config.app.name} Server running`);
  console.log(`Mode: ${config.app.mode}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`LAN: http://${HOST}:${PORT}`);
  console.log(`-------------------------------------------`);
});
