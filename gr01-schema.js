// ═══════════════════════════════════════════════════════════
// iGram GR-01 Universal Schema — Master Information Architecture
// Adds the unified Customer + Service Request + Audit spine
// on top of the existing database. Idempotent (safe to re-run).
// ═══════════════════════════════════════════════════════════
function applyGR01Schema(db) {
  db.exec(`
  -- ── Customer_Master: one identity, many services ──
  CREATE TABLE IF NOT EXISTS Customer_Master (
    Customer_ID    TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    phone          TEXT UNIQUE NOT NULL,
    email          TEXT,
    gender         TEXT,
    village        TEXT,
    taluka         TEXT,
    district       TEXT,
    state          TEXT,
    household_id   TEXT,
    language       TEXT DEFAULT 'English',
    hub_id         TEXT,
    created_by     INTEGER,
    created_at     TEXT DEFAULT (datetime('now','localtime'))
  );

  -- ── Service catalogue (per GR-01 Service Module Register) ──
  CREATE TABLE IF NOT EXISTS Service_Catalogue (
    service_code   TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    category       TEXT NOT NULL,
    is_active      INTEGER DEFAULT 1
  );

  -- ── Service_Request_Master: universal header for EVERY service ──
  CREATE TABLE IF NOT EXISTS Service_Request_Master (
    Request_ID     TEXT PRIMARY KEY,
    Customer_ID    TEXT NOT NULL,
    service_code   TEXT NOT NULL,
    category       TEXT,
    title          TEXT,
    status         TEXT DEFAULT 'DRAFT',
    sub_status     TEXT,
    priority       TEXT DEFAULT 'Normal',
    hub_id         TEXT,
    district       TEXT,
    state          TEXT,
    assigned_mitra INTEGER,
    assigned_partner INTEGER,
    amount         INTEGER DEFAULT 0,
    payment_status TEXT DEFAULT 'UNPAID',
    notes          TEXT,
    created_by     INTEGER,
    created_at     TEXT DEFAULT (datetime('now','localtime')),
    updated_at     TEXT
  );

  -- ── Service-specific detail (key/value JSON blob per request) ──
  CREATE TABLE IF NOT EXISTS Service_Request_Detail (
    Request_Detail_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Request_ID     TEXT NOT NULL,
    detail_json    TEXT,
    created_at     TEXT DEFAULT (datetime('now','localtime'))
  );

  -- ── Payment_Master ──
  CREATE TABLE IF NOT EXISTS Payment_Master (
    Payment_ID     TEXT PRIMARY KEY,
    Request_ID     TEXT,
    Customer_ID    TEXT,
    amount         INTEGER NOT NULL,
    method         TEXT DEFAULT 'Cash',
    status         TEXT DEFAULT 'COLLECTED',
    collected_by   INTEGER,
    created_at     TEXT DEFAULT (datetime('now','localtime'))
  );

  -- ── System_Audit_Log: every material action ──
  CREATE TABLE IF NOT EXISTS System_Audit_Log (
    Audit_ID       INTEGER PRIMARY KEY AUTOINCREMENT,
    event_code     TEXT NOT NULL,
    actor_id       INTEGER,
    actor_role     TEXT,
    entity         TEXT,
    entity_id      TEXT,
    detail         TEXT,
    created_at     TEXT DEFAULT (datetime('now','localtime'))
  );

  -- ── n8n / AI-Agent integration webhooks ──
  CREATE TABLE IF NOT EXISTS Integration_Webhook (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    event_code     TEXT NOT NULL,
    url            TEXT NOT NULL,
    is_active      INTEGER DEFAULT 1,
    created_at     TEXT DEFAULT (datetime('now','localtime'))
  );

  -- ── Status history for the universal lifecycle ──
  CREATE TABLE IF NOT EXISTS Request_Status_History (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    Request_ID     TEXT NOT NULL,
    from_status    TEXT,
    to_status      TEXT,
    note           TEXT,
    changed_by     INTEGER,
    changed_at     TEXT DEFAULT (datetime('now','localtime'))
  );
  `);

  // Seed the Service Catalogue from the GR-01 register (idempotent)
  const services = [
    ['AGR-01','AgriUber','Agriculture'],
    ['AGR-02','Crop Tracking','Agriculture'],
    ['AGR-03','Drone Services','Agriculture'],
    ['AGR-04','Soil Testing','Agriculture'],
    ['HLT-01','Telemedicine','Health'],
    ['HLT-02','eHealth Record','Health'],
    ['HLT-03','Lab / Diagnostics','Health'],
    ['HLT-04','Medicine Order','Health'],
    ['JOB-01','Job Seeker Registration','Jobs'],
    ['JOB-02','Job Vacancy / Application','Jobs'],
    ['JOB-03','Employer Registration','Jobs'],
    ['EDU-01','Student Registration','Education'],
    ['EDU-02','Admission Support','Education'],
    ['EDU-03','Scholarship','Education'],
    ['EDU-04','Coaching Enrolment','Education'],
    ['FIN-01','Banking / AePS','Finance'],
    ['FIN-02','Insurance','Finance'],
    ['FIN-03','Pension','Finance'],
    ['FIN-04','Loan Facilitation','Finance'],
    ['GOV-01','Government Application','Government'],
    ['GOV-02','Certificate Service','Government'],
    ['MKT-01','Marketplace Order','Commerce'],
    ['WHS-01','Wholesale Order','Commerce'],
    ['LOG-01','Courier / Shipment','Logistics'],
    ['TEL-01','Telecom / SIM / Recharge','Telecom'],
    ['TRV-01','Travel Ticketing','Travel'],
    ['PRT-01','Print / Scan / Digital Desk','Digital'],
    ['PRO-01','Professional Services','Professional'],
    ['CNT-01','Content / Data / Design','Creative'],
    ['AIH-01','AI Helpdesk','Shared']
  ];
  const ins = db.prepare('INSERT OR IGNORE INTO Service_Catalogue (service_code,name,category) VALUES (?,?,?)');
  for (const s of services) ins.run(s[0], s[1], s[2]);
}

module.exports = { applyGR01Schema };
