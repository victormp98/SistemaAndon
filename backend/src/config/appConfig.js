const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../../../config.json');

let config = {};

try {
  const configFile = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configFile);
} catch (error) {
  console.error('Error loading config.json:', error);
  // Fallback default config
  config = {
    server: { host: '0.0.0.0', port: 3000 },
    database: { path: 'data/database.sqlite' },
    app: { name: 'Laboratorio Industrial', mode: 'local-lan' }
  };
}

config.server = {
  ...config.server,
  host: process.env.HOST || config.server?.host || '0.0.0.0',
  port: Number(process.env.PORT || config.server?.port || 3000)
};

config.database = {
  ...config.database,
  path: process.env.DATABASE_PATH || config.database?.path || 'data/database.sqlite'
};

config.auth = {
  ...config.auth,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || config.auth?.jwtExpiresIn || '8h'
};

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Configure it in the local .env file.');
}

module.exports = config;
