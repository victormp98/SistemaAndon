const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const config = require('./config/appConfig');
const db = require('./database/connection');
const createApp = require('./app');
const setupSockets = require('./sockets/socketServer');
const { ensureDailyBackup } = require('./services/backupService');
const settingsService = require('./services/settingsService');

async function start() {
  await db.ready;
  await ensureDailyBackup(await settingsService.getValue('backup_retention'));
  const app = createApp();
  const server = config.tls.enabled
    ? https.createServer({
      key: fs.readFileSync(config.tls.keyPath),
      cert: fs.readFileSync(config.tls.certPath)
    }, app)
    : http.createServer(app);
  const io = setupSockets(server);
  app.set('io', io);

  server.listen(config.server.port, config.server.host, () => {
    const protocol = config.tls.enabled ? 'https' : 'http';
    console.log(`${config.app.name} running at ${protocol}://localhost:${config.server.port}`);
    Object.values(os.networkInterfaces()).flat().filter((item) => item?.family === 'IPv4' && !item.internal)
      .forEach((item) => console.log(`LAN: ${protocol}://${item.address}:${config.server.port}`));
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
