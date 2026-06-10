const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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
const analyticsRoutes = require('./routes/analytics.routes');
const incidentsRoutes = require('./routes/incidents.routes');
const settingsRoutes = require('./routes/settings.routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

function createApp() {
  const app = express();
  const allowedOrigins = new Set([
    `http://localhost:${config.server.port}`,
    'http://localhost:5173',
    ...(process.env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)
  ]);

  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error('Origen no permitido por CORS.'));
    }
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false
  }));

  app.use('/api', healthRoutes);
  app.use('/api/db', dbRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentsRoutes);
  app.use('/api/laboratories', laboratoriesRoutes);
  app.use('/api/simulations', simulationsRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/operator', operatorRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/incidents', incidentsRoutes);
  app.use('/api/settings', settingsRoutes);

  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*splat', (req, res, next) => {
    if (req.path.startsWith('/api') || !req.accepts('html')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
