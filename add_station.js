const db = require('./backend/src/database/connection');
db.run("INSERT INTO stations (line_id, name, sequence_order, target_cycle_time_seconds, allows_defects, allows_downtime, is_active) VALUES (1, 'Prueba', 2, 40, 1, 1, 1)", () => {
  console.log('Station 2 added to line 1');
  db.close();
});
