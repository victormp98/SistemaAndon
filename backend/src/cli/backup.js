const db = require('../database/connection');
const backupService = require('../services/backupService');

db.ready
  .then(() => backupService.createBackup('launcher'))
  .then((file) => {
    console.log(file);
    db.close();
  })
  .catch((error) => {
    console.error(error.message);
    db.close(() => process.exit(1));
  });
