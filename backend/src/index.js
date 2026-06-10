const http = require('http');
const config = require('./config/appConfig');
const db = require('./database/connection');
const createApp = require('./app');
const setupSockets = require('./sockets/socketServer');
const { ensureDailyBackup } = require('./services/backupService');

async function start() {
  await db.ready;
  await ensureDailyBackup();
  const app = createApp();
  const server = http.createServer(app);
  const io = setupSockets(server);
  app.set('io', io);

  server.listen(config.server.port, config.server.host, () => {
    console.log(`${config.app.name} running at http://localhost:${config.server.port}`);
  });

  const shutdown = () => {
    server.close(() => db.close(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
