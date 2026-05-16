/**
 * Database Schema Definitions
 * Includes table creation and initial indexing for SQLite.
 */

const bcrypt = require('bcryptjs');

function initSchema(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      try {
        // 1. Users
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          user_type TEXT NOT NULL DEFAULT 'student',
          student_code TEXT,
          group_name TEXT,
          is_active INTEGER DEFAULT 1,
          must_change_password INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2. Laboratories
        db.run(`CREATE TABLE IF NOT EXISTS laboratories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          created_by_user_id INTEGER,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by_user_id) REFERENCES users (id)
        )`);

        // 3. Production Lines
        db.run(`CREATE TABLE IF NOT EXISTS production_lines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          laboratory_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          sequence_order INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (laboratory_id) REFERENCES laboratories (id)
        )`);

        // 4. Stations
        db.run(`CREATE TABLE IF NOT EXISTS stations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          line_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          instructions TEXT,
          sequence_order INTEGER DEFAULT 0,
          target_cycle_time_seconds INTEGER DEFAULT 0,
          allows_defects INTEGER DEFAULT 1,
          allows_downtime INTEGER DEFAULT 1,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (line_id) REFERENCES production_lines (id)
        )`);

        // 5. Simulations
        db.run(`CREATE TABLE IF NOT EXISTS simulations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          laboratory_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          starts_at DATETIME,
          ends_at DATETIME,
          planned_duration_minutes INTEGER,
          created_by_user_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (laboratory_id) REFERENCES laboratories (id),
          FOREIGN KEY (created_by_user_id) REFERENCES users (id)
        )`);

        // 6. Simulation Participants
        db.run(`CREATE TABLE IF NOT EXISTS simulation_participants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          simulation_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          simulation_role TEXT NOT NULL,
          line_id INTEGER,
          station_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (simulation_id) REFERENCES simulations (id),
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (line_id) REFERENCES production_lines (id),
          FOREIGN KEY (station_id) REFERENCES stations (id)
        )`);

        // 7. Production Orders
        db.run(`CREATE TABLE IF NOT EXISTS production_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          simulation_id INTEGER NOT NULL,
          line_id INTEGER NOT NULL,
          code TEXT UNIQUE NOT NULL,
          product_name TEXT NOT NULL,
          target_quantity INTEGER NOT NULL,
          priority TEXT NOT NULL DEFAULT 'medium',
          status TEXT NOT NULL DEFAULT 'draft',
          created_by_user_id INTEGER,
          released_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (simulation_id) REFERENCES simulations (id),
          FOREIGN KEY (line_id) REFERENCES production_lines (id),
          FOREIGN KEY (created_by_user_id) REFERENCES users (id)
        )`);

        // 8. Production Tickets
        db.run(`CREATE TABLE IF NOT EXISTS production_tickets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          code TEXT UNIQUE NOT NULL,
          current_station_id INTEGER,
          current_operator_id INTEGER,
          status TEXT NOT NULL DEFAULT 'waiting',
          priority TEXT NOT NULL DEFAULT 'medium',
          started_at DATETIME,
          completed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES production_orders (id),
          FOREIGN KEY (current_station_id) REFERENCES stations (id),
          FOREIGN KEY (current_operator_id) REFERENCES users (id)
        )`);

        // 9. Ticket Station Logs
        db.run(`CREATE TABLE IF NOT EXISTS ticket_station_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_id INTEGER NOT NULL,
          station_id INTEGER NOT NULL,
          operator_user_id INTEGER,
          started_at DATETIME,
          finished_at DATETIME,
          status TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (ticket_id) REFERENCES production_tickets (id),
          FOREIGN KEY (station_id) REFERENCES stations (id),
          FOREIGN KEY (operator_user_id) REFERENCES users (id)
        )`);

        // 10. Production Events
        db.run(`CREATE TABLE IF NOT EXISTS production_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          simulation_id INTEGER,
          order_id INTEGER,
          ticket_id INTEGER,
          station_id INTEGER,
          user_id INTEGER,
          event_type TEXT NOT NULL,
          payload_json TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (simulation_id) REFERENCES simulations (id),
          FOREIGN KEY (order_id) REFERENCES production_orders (id),
          FOREIGN KEY (ticket_id) REFERENCES production_tickets (id),
          FOREIGN KEY (station_id) REFERENCES stations (id),
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // 11. Incidents
        db.run(`CREATE TABLE IF NOT EXISTS incidents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          simulation_id INTEGER NOT NULL,
          line_id INTEGER,
          station_id INTEGER,
          ticket_id INTEGER,
          reported_by_user_id INTEGER,
          assigned_to_user_id INTEGER,
          type TEXT,
          severity TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          description TEXT,
          response_started_at DATETIME,
          resolved_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (simulation_id) REFERENCES simulations (id),
          FOREIGN KEY (line_id) REFERENCES production_lines (id),
          FOREIGN KEY (station_id) REFERENCES stations (id),
          FOREIGN KEY (ticket_id) REFERENCES production_tickets (id),
          FOREIGN KEY (reported_by_user_id) REFERENCES users (id),
          FOREIGN KEY (assigned_to_user_id) REFERENCES users (id)
        )`);

        // 12. Downtime Events
        db.run(`CREATE TABLE IF NOT EXISTS downtime_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          simulation_id INTEGER NOT NULL,
          station_id INTEGER,
          ticket_id INTEGER,
          reported_by_user_id INTEGER,
          reason TEXT,
          status TEXT,
          started_at DATETIME,
          ended_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (simulation_id) REFERENCES simulations (id),
          FOREIGN KEY (station_id) REFERENCES stations (id),
          FOREIGN KEY (ticket_id) REFERENCES production_tickets (id),
          FOREIGN KEY (reported_by_user_id) REFERENCES users (id)
        )`);

        // 13. KPI Snapshots
        db.run(`CREATE TABLE IF NOT EXISTS kpi_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          simulation_id INTEGER NOT NULL,
          line_id INTEGER,
          station_id INTEGER,
          snapshot_type TEXT,
          data_json TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (simulation_id) REFERENCES simulations (id),
          FOREIGN KEY (line_id) REFERENCES production_lines (id),
          FOREIGN KEY (station_id) REFERENCES stations (id)
        )`);

        // 14. App Settings
        db.run(`CREATE TABLE IF NOT EXISTS app_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // --- Indexes ---
        db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_stations_line_id ON stations(line_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_simulation_participants_sim_id ON simulation_participants(simulation_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_simulation_participants_user_id ON simulation_participants(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_production_orders_code ON production_orders(code)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_production_tickets_code ON production_tickets(code)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_production_events_sim_id ON production_events(simulation_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_production_events_ticket_id ON production_events(ticket_id)`);

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function seedInitialAdmin(db) {
  return new Promise((resolve, reject) => {
    db.get("SELECT id FROM users WHERE username = 'admin'", [], async (err, row) => {
      if (err) return reject(err);
      if (row) {
        console.log("Initial admin already exists.");
        return resolve();
      }

      try {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        db.run(
          `INSERT INTO users (name, username, email, password_hash, user_type, is_active, must_change_password)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ['Profesor Administrador', 'admin', 'admin@local.test', hashedPassword, 'professor', 1, 1],
          (err) => {
            if (err) return reject(err);
            console.log("Initial admin user created successfully.");
            resolve();
          }
        );
      } catch (hashErr) {
        reject(hashErr);
      }
    });
  });
}

module.exports = { initSchema, seedInitialAdmin };
