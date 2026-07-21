// ═══════════════════════════════════════════════
// iGram Digital — Database (SQLite, zero-config)
// ═══════════════════════════════════════════════
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('./hash');
const path = require('path');
const { applyGR01Schema } = require('./gr01-schema');

const db = new DatabaseSync(path.join(__dirname, 'igram.db'));
db.exec('PRAGMA journal_mode = WAL;');

// ── Tables ──────────────────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user',          -- user | mitra | provider | admin
  village TEXT, taluka TEXT, district TEXT, state TEXT,
  language TEXT DEFAULT 'Telugu',
  status TEXT DEFAULT 'active',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_ref TEXT UNIQUE,
  user_id INTEGER,
  farmer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  village TEXT, taluka TEXT,
  equipment TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  land_size TEXT, crop_type TEXT, notes TEXT,
  language TEXT DEFAULT 'Telugu',
  amount INTEGER DEFAULT 200,
  status TEXT DEFAULT 'pending',              -- pending | confirmed | completed | cancelled
  mitra_id INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS farmers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, phone TEXT NOT NULL, whatsapp TEXT,
  village TEXT, taluka TEXT, district TEXT,
  crop_type TEXT, land_size TEXT, language TEXT DEFAULT 'Telugu',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS machine_owners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, phone TEXT NOT NULL, village TEXT,
  machine_type TEXT NOT NULL, model TEXT, hp TEXT,
  rate_per_day INTEGER, operator TEXT DEFAULT 'Yes',
  available_days TEXT,
  status TEXT DEFAULT 'pending_verify',       -- pending_verify | active | suspended
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_ref TEXT UNIQUE,
  user_id INTEGER,
  applicant_name TEXT NOT NULL, phone TEXT NOT NULL,
  village TEXT, district TEXT,
  service TEXT NOT NULL,                      -- e.g. "PM-Kisan Registration"
  details TEXT,
  status TEXT DEFAULT 'submitted',            -- submitted | in_review | approved | rejected | completed
  mitra_id INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS mitra_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, phone TEXT NOT NULL, whatsapp TEXT, email TEXT,
  village TEXT, taluka TEXT, state TEXT, education TEXT,
  device TEXT, motivation TEXT,
  status TEXT DEFAULT 'pending',              -- pending | approved | rejected
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT DEFAULT 'login',
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  doc_name TEXT NOT NULL,
  doc_type TEXT,
  file_data TEXT,
  status TEXT DEFAULT 'uploaded',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
  subject TEXT, message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS service_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  req_ref TEXT UNIQUE,
  name TEXT NOT NULL, phone TEXT NOT NULL,
  village TEXT, district TEXT,
  service_interest TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'new',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
`);


// ── Safe migrations (add columns if upgrading an existing DB) ──
function ensureColumn(table, column, definition) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (e) { /* ignore */ }
}
ensureColumn('users', 'is_active', 'INTEGER DEFAULT 1');
ensureColumn('users', 'district', 'TEXT');
ensureColumn('users', 'taluka', 'TEXT');
ensureColumn('bookings', 'district', 'TEXT');
ensureColumn('bookings', 'state', 'TEXT');
ensureColumn('bookings', 'crop_type', 'TEXT');
ensureColumn('bookings', 'provider_id', 'INTEGER');
ensureColumn('applications', 'taluka', 'TEXT');
ensureColumn('applications', 'state', 'TEXT');
ensureColumn('bookings', 'status_note', 'TEXT');
ensureColumn('bookings', 'updated_at', 'TEXT');
ensureColumn('applications', 'status_note', 'TEXT');
ensureColumn('applications', 'updated_at', 'TEXT');

// ── GR-01 universal schema ──
applyGR01Schema(db);

// ── Seed admin account (run once) ───────────────
const adminExists = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
if (!adminExists) {
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'igram@2025');
  db.prepare(`INSERT INTO users (name, phone, email, password_hash, role, state)
              VALUES (?, ?, ?, ?, 'admin', 'Telangana')`)
    .run('iGram Admin', '8106442080', 'igram.hub@gmail.com', hash);
  console.log('✅ Admin account created — phone: 8106442080, password: igram@2025 (change via ADMIN_PASSWORD env)');
}

// ── Helpers ─────────────────────────────────────
function logActivity(event, detail) {
  db.prepare('INSERT INTO activity_log (event, detail) VALUES (?, ?)').run(event, detail || '');
}

function generateRef(prefix) {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${new Date().getFullYear()}-${n}`;
}

module.exports = { db, logActivity, generateRef };
