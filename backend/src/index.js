const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const config = require('./config/appConfig');
const healthRoutes = require('./routes/health.routes');
const dbRoutes = require('./routes/db.routes');
const authRoutes = require('./routes/auth.routes');
const studentsRoutes = require('./routes/students.routes');
const laboratoriesRoutes = require('./routes/laboratories.routes');
const simulationsRoutes = require('./routes/simulations.routes');
const ordersRoutes = require('./routes/orders.routes');
const operatorRoutes = require('./routes/operator.routes');
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
app.use('/api/students', studentsRoutes);
app.use('/api/laboratories', laboratoriesRoutes);
app.use('/api/simulations', simulationsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/operator', operatorRoutes);

// Socket.IO
const io = setupSockets(server);
app.set('io', io);

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
