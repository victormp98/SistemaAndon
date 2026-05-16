const db = require('./backend/src/database/connection');

db.all("SELECT * FROM production_tickets WHERE id = 1", (err, tickets) => {
  console.log('TICKETS ID 1:', tickets);
  db.all("SELECT * FROM ticket_station_logs WHERE ticket_id = 1", (err, logs) => {
    console.log('LOGS ID 1:', logs);
    db.all("SELECT * FROM production_events WHERE ticket_id = 1 ORDER BY id DESC LIMIT 5", (err, events) => {
      console.log('EVENTS ID 1:', events);
      db.close();
    });
  });
});
