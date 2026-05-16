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

module.exports = config;
