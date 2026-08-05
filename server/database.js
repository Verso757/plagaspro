const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'plagas.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initializeDatabase() {
  const d = getDb();

  d.exec(`
    -- Users / authentication
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','tecnico','cliente')),
      phone TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Clients
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      business_type TEXT CHECK(business_type IN ('residencial','restaurante','bodega','industria','comercio','oficina','otro')),
      user_id INTEGER, -- link to portal user account (for client portal access)
      notes TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Sites (sucursales)
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      service_frequency TEXT CHECK(service_frequency IN ('semanal','quincenal','mensual','bimestral','trimestral','unico')),
      notes TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    -- Site-Technician assignment
    CREATE TABLE IF NOT EXISTS site_technicians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      assigned_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(site_id, user_id)
    );

    -- Plague catalog
    CREATE TABLE IF NOT EXISTS plagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Trap type catalog
    CREATE TABLE IF NOT EXISTS trap_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'default',
      default_status TEXT DEFAULT 'activa',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Event type catalog
    CREATE TABLE IF NOT EXISTS event_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Action catalog
    CREATE TABLE IF NOT EXISTS action_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Service catalog (for quotations)
    CREATE TABLE IF NOT EXISTS service_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      default_price REAL,
      unit TEXT DEFAULT 'servicio',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Sketches (croquis) - the drawing itself
    CREATE TABLE IF NOT EXISTS sketches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      background_image TEXT, -- path to uploaded image
      canvas_data TEXT, -- JSON with shapes (walls, rooms, etc.)
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Trap points on sketches
    CREATE TABLE IF NOT EXISTS trap_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sketch_id INTEGER NOT NULL,
      trap_type_id INTEGER,
      code TEXT NOT NULL, -- unique code within site
      x REAL NOT NULL,
      y REAL NOT NULL,
      status TEXT DEFAULT 'activa' CHECK(status IN ('activa','dañada','requiere_reemplazo','retirada')),
      install_date TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sketch_id) REFERENCES sketches(id) ON DELETE CASCADE,
      FOREIGN KEY (trap_type_id) REFERENCES trap_types(id)
    );

    -- Visits
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      technician_id INTEGER NOT NULL,
      visit_date TEXT DEFAULT (datetime('now')),
      notes TEXT,
      status TEXT DEFAULT 'completed' CHECK(status IN ('planned','in_progress','completed','cancelled')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (technician_id) REFERENCES users(id)
    );

    -- Events (events/incidences per visit + trap)
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER NOT NULL,
      trap_point_id INTEGER,
      event_type_id INTEGER,
      plague_id INTEGER,
      severity TEXT DEFAULT 'bajo' CHECK(severity IN ('bajo','medio','alto','urgente')),
      description TEXT,
      actions_taken TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
      FOREIGN KEY (trap_point_id) REFERENCES trap_points(id) ON DELETE SET NULL,
      FOREIGN KEY (event_type_id) REFERENCES event_types(id),
      FOREIGN KEY (plague_id) REFERENCES plagues(id)
    );

    -- Event photos
    CREATE TABLE IF NOT EXISTS event_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    -- Quotations
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      site_id INTEGER,
      created_by INTEGER NOT NULL,
      status TEXT DEFAULT 'borrador' CHECK(status IN ('borrador','enviada','aceptada','rechazada')),
      total REAL DEFAULT 0,
      valid_until TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (site_id) REFERENCES sites(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Quotation items
    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      service_catalog_id INTEGER,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (service_catalog_id) REFERENCES service_catalog(id)
    );

    -- Document templates
    CREATE TABLE IF NOT EXISTS document_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('certificate', 'report', 'quotation')),
      logo_path TEXT,
      header_text TEXT,
      footer_text TEXT,
      primary_color TEXT DEFAULT '#003043',
      template_config TEXT, -- JSON with custom settings
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Invoices / payments
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      site_id INTEGER,
      quotation_id INTEGER,
      number TEXT NOT NULL,
      amount REAL NOT NULL,
      tax REAL DEFAULT 0,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pendiente' CHECK(status IN ('pendiente','pagada','vencida','cancelada')),
      issue_date TEXT,
      due_date TEXT,
      paid_date TEXT,
      payment_method TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (site_id) REFERENCES sites(id),
      FOREIGN KEY (quotation_id) REFERENCES quotations(id)
    );

    -- Thresholds for trap monitoring
    CREATE TABLE IF NOT EXISTS thresholds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trap_point_id INTEGER NOT NULL,
      plague_id INTEGER,
      max_count INTEGER NOT NULL,
      period TEXT DEFAULT 'mensual' CHECK(period IN ('semanal','mensual','trimestral')),
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (trap_point_id) REFERENCES trap_points(id) ON DELETE CASCADE,
      FOREIGN KEY (plague_id) REFERENCES plagues(id)
    );
  `);

  // Add qr_code column to trap_points if missing
  try {
    d.exec('ALTER TABLE trap_points ADD COLUMN qr_code TEXT');
  } catch (e) {
    // Column already exists - that's fine
  }

  console.log('Database initialized successfully.');
  return d;
}

module.exports = { getDb, initializeDatabase };