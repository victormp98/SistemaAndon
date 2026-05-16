const db = require('./backend/src/database/connection');
db.all('SELECT status, current_operator_id FROM production_tickets WHERE status = "in_progress"', (err, tickets) => {
  console.log('TICKETS:', tickets);
  db.all('SELECT * FROM ticket_station_logs', (err, logs) => {
    console.log('LOGS:', logs);
    db.all('SELECT * FROM production_events WHERE event_type = "ticket_started"', (err, events) => {
      console.log('EVENTS:', events);
      db.close();
    });
  });
});
