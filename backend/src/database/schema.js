const bcrypt = require('bcryptjs');
const { run, get } = require('./dbUtils');

const migrations = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        user_type TEXT NOT NULL DEFAULT 'student',
        student_code TEXT,
        group_name TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS laboratories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_by_user_id INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by_user_id) REFERENCES users (id)
      )`,
      `CREATE TABLE IF NOT EXISTS production_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        laboratory_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        sequence_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (laboratory_id) REFERENCES laboratories (id)
      )`,
      `CREATE TABLE IF NOT EXISTS stations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        line_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        instructions TEXT,
        sequence_order INTEGER NOT NULL DEFAULT 0,
        target_cycle_time_seconds INTEGER NOT NULL DEFAULT 0,
        allows_defects INTEGER NOT NULL DEFAULT 1,
        allows_downtime INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (line_id) REFERENCES production_lines (id)
      )`,
      `CREATE TABLE IF NOT EXISTS simulations (
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
      )`,
      `CREATE TABLE IF NOT EXISTS simulation_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        simulation_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        simulation_role TEXT NOT NULL,
        line_id INTEGER,
        station_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (simulation_id) REFERENCES simulations (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (line_id) REFERENCES production_lines (id),
        FOREIGN KEY (station_id) REFERENCES stations (id)
      )`,
      `CREATE TABLE IF NOT EXISTS production_orders (
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
      )`,
      `CREATE TABLE IF NOT EXISTS production_tickets (
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
      )`,
      `CREATE TABLE IF NOT EXISTS ticket_station_logs (
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
      )`,
      `CREATE TABLE IF NOT EXISTS production_events (
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
      )`,
      `CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        simulation_id INTEGER NOT NULL,
        line_id INTEGER,
        station_id INTEGER,
        ticket_id INTEGER,
        reported_by_user_id INTEGER,
        assigned_to_user_id INTEGER,
        type TEXT NOT NULL DEFAULT 'other',
        severity TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'open',
        description TEXT NOT NULL,
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
      )`,
      `CREATE TABLE IF NOT EXISTS downtime_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        simulation_id INTEGER NOT NULL,
        station_id INTEGER,
        ticket_id INTEGER,
        reported_by_user_id INTEGER,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (simulation_id) REFERENCES simulations (id),
        FOREIGN KEY (station_id) REFERENCES stations (id),
        FOREIGN KEY (ticket_id) REFERENCES production_tickets (id),
        FOREIGN KEY (reported_by_user_id) REFERENCES users (id)
      )`,
      `CREATE TABLE IF NOT EXISTS kpi_snapshots (
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
      )`,
      `CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS order_sequences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        next_value INTEGER NOT NULL
      )`,
      `INSERT OR IGNORE INTO order_sequences (id, next_value) VALUES (1, 1)`
    ]
  },
  {
    version: 2,
    statements: [
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_participant_sim_user
       ON simulation_participants(simulation_id, user_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_operator_sim_station
       ON simulation_participants(simulation_id, station_id)
       WHERE simulation_role = 'operator' AND station_id IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_operator_active_ticket
       ON production_tickets(current_operator_id)
       WHERE status = 'in_progress' AND current_operator_id IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_lines_laboratory ON production_lines(laboratory_id)`,
      `CREATE INDEX IF NOT EXISTS idx_stations_line_id ON stations(line_id)`,
      `CREATE INDEX IF NOT EXISTS idx_simulations_status ON simulations(status)`,
      `CREATE INDEX IF NOT EXISTS idx_participants_user ON simulation_participants(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_simulation ON production_orders(simulation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tickets_order ON production_tickets(order_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tickets_station_status ON production_tickets(current_station_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_events_simulation ON production_events(simulation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_incidents_simulation_status ON incidents(simulation_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_downtime_simulation_status ON downtime_events(simulation_id, status)`
    ]
  },
  {
    version: 3,
    statements: [
      `ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN owner_user_id INTEGER REFERENCES users(id)`,
      `CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        simulation_id INTEGER,
        success INTEGER NOT NULL DEFAULT 1,
        details_json TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (simulation_id) REFERENCES simulations(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_users_owner ON users(owner_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions(user_id, revoked_at)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_simulation ON audit_logs(simulation_id)`,
      `UPDATE users SET is_admin = 1 WHERE username = 'admin'`,
      `UPDATE users SET owner_user_id = (
        SELECT id FROM users WHERE username = 'admin'
      ) WHERE user_type = 'student' AND owner_user_id IS NULL`,
      `UPDATE laboratories SET created_by_user_id = (
        SELECT id FROM users WHERE username = 'admin'
      ) WHERE created_by_user_id IS NULL`,
      `UPDATE simulations SET created_by_user_id = (
        SELECT id FROM users WHERE username = 'admin'
      ) WHERE created_by_user_id IS NULL`,
      `UPDATE production_orders SET created_by_user_id = (
        SELECT id FROM users WHERE username = 'admin'
      ) WHERE created_by_user_id IS NULL`
    ]
  },
  {
    version: 4,
    statements: [
      `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('organization_name', 'Laboratorio Industrial')`,
      `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('andon_refresh_seconds', '15')`,
      `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('max_ticket_quantity', '500')`,
      `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('backup_retention', '10')`
    ]
  }
];

async function initSchema(db) {
  await run(db, `CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  for (const migration of migrations) {
    const applied = await get(db, 'SELECT version FROM schema_migrations WHERE version = ?', [migration.version]);
    if (applied) continue;

    await run(db, 'BEGIN IMMEDIATE TRANSACTION');
    try {
      for (const statement of migration.statements) {
        await run(db, statement);
      }
      await run(db, 'INSERT INTO schema_migrations (version) VALUES (?)', [migration.version]);
      await run(db, 'COMMIT');
    } catch (error) {
      await run(db, 'ROLLBACK');
      throw error;
    }
  }
}

async function seedInitialAdmin(db) {
  const existing = await get(db, "SELECT id FROM users WHERE username = 'admin'");
  if (existing) return;

  const passwordHash = await bcrypt.hash('admin123', 12);
  await run(
    db,
    `INSERT INTO users
     (name, username, email, password_hash, user_type, is_active, must_change_password)
     VALUES (?, ?, ?, ?, 'professor', 1, 1)`,
    ['Profesor Administrador', 'admin', 'admin@local.test', passwordHash]
  );
  await run(db, "UPDATE users SET is_admin = 1 WHERE username = 'admin'");
}

module.exports = { initSchema, seedInitialAdmin };
