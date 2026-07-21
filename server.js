// ═══════════════════════════════════════════════════════════════
// iGram Digital Hub — Full-Stack Server (ZERO dependencies)
// Pure Node.js built-ins: http, sqlite, crypto, fs, path
// Requires Node >= 22.5  |  Run:  node server.js
// ═══════════════════════════════════════════════════════════════
const http = require('http');
const fs = require('fs');
const path = require('path');
const { db, logActivity, generateRef } = require('./database');
const bcrypt = require('./hash');
const { LOCATIONS, CROP_TYPES, EQUIPMENT_TYPES, GOVT_SERVICES } = require('./locations');
const jwt = require('./jwt');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'igram-dev-secret-change-in-production';
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html':'text/html', '.css':'text/css', '.js':'application/javascript',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2'
};

// ── Tiny helpers ────────────────────────────────────────────────
function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) { reject(new Error('Body too large')); req.destroy(); } });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch { resolve(Object.fromEntries(new URLSearchParams(data))); }
    });
    req.on('error', reject);
  });
}

function getUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function requireLogin(req, res) {
  const u = getUser(req);
  if (!u) { send(res, 401, { error: 'Please sign in to use this service. Create a free account first.' }); return null; }
  return u;
}

function requireAdmin(req, res) {
  const u = getUser(req);
  if (!u) { send(res, 401, { error: 'Login required' }); return null; }
  if (u.role !== 'admin') { send(res, 403, { error: 'Access denied' }); return null; }
  return u;
}

function requireRole(req, res, roles) {
  const u = getUser(req);
  if (!u) { send(res, 401, { error: 'Login required' }); return null; }
  if (u.role !== 'admin' && !roles.includes(u.role)) { send(res, 403, { error: 'Access denied' }); return null; }
  return u;
}

// Block login if account deactivated by admin
function isActive(userId) {
  const row = db.prepare('SELECT is_active FROM users WHERE id=?').get(userId);
  return row && row.is_active === 1;
}

function genOTP() { return String(Math.floor(100000 + Math.random()*900000)); }


// ── Static file serving ─────────────────────────────────────────
function serveStatic(req, res, urlPath) {
  let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  filePath = path.normalize(filePath);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fallback to index.html for unknown non-API routes
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, idx) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(idx);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

// ── API routes ──────────────────────────────────────────────────
// ── GR-01 universal routes (Customer + Service Request + Payments + Dashboard) ──
const { buildGR01Routes } = require('./gr01-api');
const GR01_ROUTES = buildGR01Routes({ send, readBody, getUser });

// Match a GR-01 route that may contain {id} params. Returns {handler, params} or null.
function matchGR01(method, urlPath) {
  const key = `${method} ${urlPath}`;
  if (GR01_ROUTES[key]) return { handler: GR01_ROUTES[key], params: {} };
  for (const routeKey of Object.keys(GR01_ROUTES)) {
    if (!routeKey.includes('{')) continue;
    const [rMethod, rPath] = routeKey.split(' ');
    if (rMethod !== method) continue;
    const rParts = rPath.split('/'); const uParts = urlPath.split('/');
    if (rParts.length !== uParts.length) continue;
    const params = {}; let ok = true;
    for (let i = 0; i < rParts.length; i++) {
      if (rParts[i].startsWith('{') && rParts[i].endsWith('}')) params[rParts[i].slice(1,-1)] = decodeURIComponent(uParts[i]);
      else if (rParts[i] !== uParts[i]) { ok = false; break; }
    }
    if (ok) return { handler: GR01_ROUTES[routeKey], params };
  }
  return null;
}

const routes = {

  // AUTH ─────────────────────────────────────────
  'POST /api/auth/register': async (req, res) => {
    let { name, phone, email, password, role = 'user', village, taluka, district, state, countryCode } = await readBody(req);
    if (!name || !phone || !password) return send(res, 400, { error: 'name, phone, password required' });
    if (!['user','mitra','provider','hub_manager'].includes(role)) return send(res, 400, { error: 'Invalid role' });
    // Phone validation: digits only, 10 digits (India)
    phone = String(phone).replace(/[^0-9]/g, '');
    if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
    if (phone.length !== 10) return send(res, 400, { error: 'Enter a valid 10-digit mobile number' });
    if (password.length < 4) return send(res, 400, { error: 'Password must be at least 4 characters' });
    try {
      const hash = bcrypt.hashSync(password);
      const r = db.prepare(`INSERT INTO users (name,phone,email,password_hash,role,village,taluka,district,state)
                            VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(name, phone, email || null, hash, role, village || null, taluka || null, district || null, state || null);
      logActivity('user_registered', `${name} (${role})`);
      const token = jwt.sign({ id: Number(r.lastInsertRowid), name, role }, JWT_SECRET);
      send(res, 200, { ok: true, token, user: { id: Number(r.lastInsertRowid), name, phone, role } });
    } catch (e) {
      if (String(e).includes('UNIQUE')) return send(res, 409, { error: 'Phone already registered. Please sign in.' });
      send(res, 500, { error: 'Registration failed' });
    }
  },

  'POST /api/auth/login': async (req, res) => {
    let { phone, email, password } = await readBody(req);
    let user;
    if (email) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    } else {
      phone = String(phone || '').replace(/[^0-9]/g, '');
      if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
      user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    }
    if (!user || !bcrypt.compareSync(password || '', user.password_hash || '')) {
      return send(res, 401, { error: 'Invalid mobile/email or password' });
    }
    if (user.is_active === 0) return send(res, 403, { error: 'Your account has been deactivated. Contact iGram support.' });
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET);
    send(res, 200, { ok: true, token, user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role } });
  },

  // ── OTP login (demo mode: code returned in response; swap for SMS gateway later) ──
  'POST /api/auth/send-otp': async (req, res) => {
    let { phone } = await readBody(req);
    phone = String(phone || '').replace(/[^0-9]/g, '');
    if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
    if (phone.length !== 10) return send(res, 400, { error: 'Enter a valid 10-digit mobile number' });
    const code = genOTP();
    const expires = new Date(Date.now() + 5*60*1000).toISOString();
    db.prepare('INSERT INTO otp_codes (phone, code, purpose, expires_at) VALUES (?,?,?,?)').run(phone, code, 'login', expires);
    logActivity('otp_sent', `OTP for ${phone}`);
    // DEMO: return the code directly. In production, send via SMS and remove demo_code.
    send(res, 200, { ok: true, message: 'OTP generated. (Demo mode — use the code shown.)', demo_code: code });
  },

  'POST /api/auth/verify-otp': async (req, res) => {
    let { phone, code, name, role } = await readBody(req);
    phone = String(phone || '').replace(/[^0-9]/g, '');
    if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
    const row = db.prepare("SELECT * FROM otp_codes WHERE phone=? AND code=? ORDER BY id DESC LIMIT 1").get(phone, String(code||''));
    if (!row) return send(res, 401, { error: 'Invalid OTP code' });
    if (new Date(row.expires_at) < new Date()) return send(res, 401, { error: 'OTP expired. Request a new one.' });
    // Find or create the user
    let user = db.prepare('SELECT * FROM users WHERE phone=?').get(phone);
    if (!user) {
      const r = db.prepare("INSERT INTO users (name, phone, role) VALUES (?,?,?)").run(name || ('User ' + phone.slice(-4)), phone, ['user','mitra','provider'].includes(role) ? role : 'user');
      user = db.prepare('SELECT * FROM users WHERE id=?').get(Number(r.lastInsertRowid));
      logActivity('user_registered', `${user.name} via OTP`);
    }
    if (user.is_active === 0) return send(res, 403, { error: 'Your account has been deactivated. Contact iGram support.' });
    db.prepare('DELETE FROM otp_codes WHERE phone=?').run(phone);
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET);
    send(res, 200, { ok: true, token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
  },

  'GET /api/auth/me': async (req, res) => {
    const u = getUser(req);
    if (!u) return send(res, 401, { error: 'Login required' });
    const profile = db.prepare('SELECT id,name,phone,email,role,village,taluka,district,state,created_at FROM users WHERE id=?').get(u.id);
    send(res, 200, { ok: true, user: profile });
  },

  // BOOKINGS ─────────────────────────────────────
  'POST /api/bookings': async (req, res) => {
    const authUser = requireLogin(req, res); if (!authUser) return;
    const { name, phone, village, taluka, district, state, equipment, date, land, crop, notes, language } = await readBody(req);
    if (!name || !phone || !equipment || !date) {
      return send(res, 400, { error: 'name, phone, equipment and date are required' });
    }
    const ref = generateRef('AG');
    db.prepare(`INSERT INTO bookings (booking_ref, user_id, farmer_name, phone, village, taluka, district, state, equipment,
                booking_date, land_size, crop_type, notes, language)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(ref, authUser.id, name, phone, village||'', taluka||'', district||'', state||'', equipment, date, land||'', crop||'', notes||'', language||'Telugu');
    logActivity('booking_created', `${ref} — ${equipment} by ${name}`);
    send(res, 200, { ok: true, booking_ref: ref,
      message: `Booking ${ref} received! We will confirm via WhatsApp within 2 hours.` });
  },

  'GET /api/bookings': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    send(res, 200, { ok: true, bookings: db.prepare('SELECT * FROM bookings ORDER BY id DESC LIMIT 500').all() });
  },

  // FARMERS / OWNERS ─────────────────────────────
  'POST /api/farmers': async (req, res) => {
    if (!requireLogin(req, res)) return;
    const { name, phone, whatsapp, village, taluka, district, crop, land, language } = await readBody(req);
    if (!name || !phone) return send(res, 400, { error: 'name and phone required' });
    db.prepare(`INSERT INTO farmers (name,phone,whatsapp,village,taluka,district,crop_type,land_size,language)
                VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(name, phone, whatsapp||'', village||'', taluka||'', district||'', crop||'', land||'', language||'Telugu');
    logActivity('farmer_registered', `${name}`);
    send(res, 200, { ok: true, message: `Welcome ${name}! You are registered as an iGram AgriUber farmer.` });
  },

  'POST /api/owners': async (req, res) => {
    if (!requireLogin(req, res)) return;
    const { name, phone, village, machineType, model, hp, rate, operator, availableDays } = await readBody(req);
    if (!name || !phone || !machineType) return send(res, 400, { error: 'name, phone, machineType required' });
    db.prepare(`INSERT INTO machine_owners (name,phone,village,machine_type,model,hp,rate_per_day,operator,available_days)
                VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(name, phone, village||'', machineType, model||'', hp||'', parseInt(rate)||200, operator||'Yes', availableDays||'');
    logActivity('owner_registered', `${name} — ${machineType}`);
    send(res, 200, { ok: true, message: `Machine registered! Our team will verify and activate within 24 hours.` });
  },

  'GET /api/owners': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    send(res, 200, { ok: true, owners: db.prepare('SELECT * FROM machine_owners ORDER BY id DESC').all() });
  },

  // APPLICATIONS ─────────────────────────────────
  'POST /api/applications': async (req, res) => {
    const authUser = requireLogin(req, res); if (!authUser) return;
    const { name, phone, village, taluka, district, state, service, details } = await readBody(req);
    if (!name || !phone || !service) return send(res, 400, { error: 'name, phone, service required' });
    const ref = generateRef('GV');
    db.prepare(`INSERT INTO applications (app_ref, user_id, applicant_name, phone, village, taluka, district, state, service, details)
                VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(ref, authUser.id, name, phone, village||'', taluka||'', district||'', state||'', service, details||'');
    logActivity('application_created', `${ref} — ${service} by ${name}`);
    send(res, 200, { ok: true, app_ref: ref,
      message: `Application ${ref} submitted! Our iGram Mitra will contact you within 24 hours.` });
  },

  'GET /api/applications': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    send(res, 200, { ok: true, applications: db.prepare('SELECT * FROM applications ORDER BY id DESC LIMIT 500').all() });
  },

  // MITRA ────────────────────────────────────────
  'POST /api/mitra/apply': async (req, res) => {
    const { name, phone, whatsapp, email, village, taluka, state, education, device, motivation } = await readBody(req);
    if (!name || !phone) return send(res, 400, { error: 'name and phone required' });
    db.prepare(`INSERT INTO mitra_applications (name,phone,whatsapp,email,village,taluka,state,education,device,motivation)
                VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(name, phone, whatsapp||'', email||'', village||'', taluka||'', state||'', education||'', device||'', motivation||'');
    logActivity('mitra_applied', `${name}`);
    send(res, 200, { ok: true, message: `Application received! Our team will contact you within 24 hours via WhatsApp.` });
  },

  'GET /api/mitra/applications': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    send(res, 200, { ok: true, applications: db.prepare('SELECT * FROM mitra_applications ORDER BY id DESC').all() });
  },

  // ADMIN ────────────────────────────────────────
  'GET /api/admin/stats': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const count = (sql) => Number(db.prepare(sql).get().c);
    send(res, 200, { ok: true, stats: {
      total_bookings:     count('SELECT COUNT(*) c FROM bookings'),
      pending_bookings:   count("SELECT COUNT(*) c FROM bookings WHERE status='pending'"),
      completed_bookings: count("SELECT COUNT(*) c FROM bookings WHERE status='completed'"),
      total_users:        count('SELECT COUNT(*) c FROM users'),
      total_farmers:      count('SELECT COUNT(*) c FROM farmers'),
      total_owners:       count('SELECT COUNT(*) c FROM machine_owners'),
      total_applications: count('SELECT COUNT(*) c FROM applications'),
      mitra_applications: count('SELECT COUNT(*) c FROM mitra_applications'),
      revenue_estimate:   count("SELECT COALESCE(SUM(amount),0) c FROM bookings WHERE status='completed'")
    }});
  },

  'GET /api/admin/activity': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    send(res, 200, { ok: true, activity: db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT 50').all() });
  },

  // PUBLIC — Contact form (no account needed)
  'POST /api/contact': async (req, res) => {
    const { name, phone, email, subject, message } = await readBody(req);
    if (!name || !phone || !message) return send(res, 400, { error: 'name, phone and message required' });
    db.prepare('INSERT INTO contacts (name,phone,email,subject,message) VALUES (?,?,?,?,?)')
      .run(name, phone, email||'', subject||'', message);
    logActivity('contact_received', `${name} — ${subject||'general'}`);
    send(res, 200, { ok: true, message: 'Thank you! Our team will reply within 24 hours on WhatsApp or call.' });
  },

  'GET /api/contacts': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    send(res, 200, { ok: true, contacts: db.prepare('SELECT * FROM contacts ORDER BY id DESC LIMIT 500').all() });
  },

  // PUBLIC — General service request (no account needed)
  'POST /api/requests': async (req, res) => {
    const { name, phone, village, district, service, message } = await readBody(req);
    if (!name || !phone || !service) return send(res, 400, { error: 'name, phone and service required' });
    const ref = generateRef('RQ');
    db.prepare(`INSERT INTO service_requests (req_ref,name,phone,village,district,service_interest,message)
                VALUES (?,?,?,?,?,?,?)`)
      .run(ref, name, phone, village||'', district||'', service, message||'');
    logActivity('request_received', `${ref} — ${service} by ${name}`);
    send(res, 200, { ok: true, req_ref: ref,
      message: `Request ${ref} received! Create a free account to track it and access all services.` });
  },

  'GET /api/requests': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    send(res, 200, { ok: true, requests: db.prepare('SELECT * FROM service_requests ORDER BY id DESC LIMIT 500').all() });
  },

  // LOGGED-IN USER — my bookings & applications
  'GET /api/my/bookings': async (req, res) => {
    const u = requireLogin(req, res); if (!u) return;
    send(res, 200, { ok: true, bookings: db.prepare('SELECT * FROM bookings WHERE user_id=? ORDER BY id DESC').all(u.id) });
  },

  'GET /api/my/applications': async (req, res) => {
    const u = requireLogin(req, res); if (!u) return;
    send(res, 200, { ok: true, applications: db.prepare('SELECT * FROM applications WHERE user_id=? ORDER BY id DESC').all(u.id) });
  },

  // ══ DOCUMENTS (user dashboard only) ══
  'POST /api/my/documents': async (req, res) => {
    const u = requireLogin(req, res); if (!u) return;
    const { doc_name, doc_type, file_data } = await readBody(req);
    if (!doc_name) return send(res, 400, { error: 'Document name required' });
    db.prepare('INSERT INTO documents (user_id, doc_name, doc_type, file_data) VALUES (?,?,?,?)')
      .run(u.id, doc_name, doc_type || '', file_data || '');
    logActivity('document_uploaded', `${u.name} uploaded ${doc_name}`);
    send(res, 200, { ok: true, message: 'Document uploaded successfully' });
  },

  'GET /api/my/documents': async (req, res) => {
    const u = requireLogin(req, res); if (!u) return;
    send(res, 200, { ok: true, documents: db.prepare('SELECT id, doc_name, doc_type, status, created_at FROM documents WHERE user_id=? ORDER BY id DESC').all(u.id) });
  },

  // ══ MITRA PORTAL — work queue & status updates ══
  // Mitra sees all pending/assigned bookings + applications in their area
  'GET /api/mitra/queue': async (req, res) => {
    const u = requireRole(req, res, ['mitra']); if (!u) return;
    const me = db.prepare('SELECT district, state FROM users WHERE id=?').get(u.id);
    let bookings, applications;
    if (me && me.district) {
      bookings = db.prepare("SELECT id, booking_ref, farmer_name, phone, village, district, state, equipment, booking_date, status, status_note, provider_id FROM bookings WHERE district=? OR district='' OR district IS NULL ORDER BY id DESC LIMIT 200").all(me.district);
      applications = db.prepare("SELECT id, app_ref, applicant_name, phone, village, district, state, service, status, status_note FROM applications WHERE district=? OR district='' OR district IS NULL ORDER BY id DESC LIMIT 200").all(me.district);
    } else {
      bookings = db.prepare("SELECT id, booking_ref, farmer_name, phone, village, district, state, equipment, booking_date, status, status_note, provider_id FROM bookings ORDER BY id DESC LIMIT 200").all();
      applications = db.prepare("SELECT id, app_ref, applicant_name, phone, village, district, state, service, status, status_note FROM applications ORDER BY id DESC LIMIT 200").all();
    }
    send(res, 200, { ok: true, bookings, applications, my_district: me ? me.district : null });
  },

  // Mitra updates a booking status
  'PATCH /api/mitra/booking-status': async (req, res) => {
    const u = requireRole(req, res, ['mitra']); if (!u) return;
    const { id, status, note } = await readBody(req);
    const valid = ['pending','confirmed','in_progress','review','completed','cancelled'];
    if (!valid.includes(status)) return send(res, 400, { error: 'Invalid status' });
    db.prepare("UPDATE bookings SET status=?, status_note=?, mitra_id=?, updated_at=datetime('now','localtime') WHERE id=?")
      .run(status, note || '', u.id, id);
    logActivity('booking_status_mitra', `Mitra ${u.name}: booking #${id} → ${status}`);
    send(res, 200, { ok: true });
  },

  // Mitra updates an application status
  'PATCH /api/mitra/application-status': async (req, res) => {
    const u = requireRole(req, res, ['mitra']); if (!u) return;
    const { id, status, note } = await readBody(req);
    const valid = ['submitted','review','in_progress','approved','completed','rejected'];
    if (!valid.includes(status)) return send(res, 400, { error: 'Invalid status' });
    db.prepare("UPDATE applications SET status=?, status_note=?, mitra_id=?, updated_at=datetime('now','localtime') WHERE id=?")
      .run(status, note || '', u.id, id);
    logActivity('application_status_mitra', `Mitra ${u.name}: application #${id} → ${status}`);
    send(res, 200, { ok: true });
  },

  // ══ ADMIN — full user/mitra/provider management ══
  'GET /api/admin/users': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const role = new URL(req.url, 'http://x').searchParams.get('role');
    let rows;
    if (role) rows = db.prepare('SELECT id,name,phone,email,role,village,taluka,district,state,is_active,created_at FROM users WHERE role=? ORDER BY id DESC').all(role);
    else rows = db.prepare('SELECT id,name,phone,email,role,village,taluka,district,state,is_active,created_at FROM users ORDER BY id DESC').all();
    send(res, 200, { ok: true, users: rows });
  },

  // Toggle access on/off
  'PATCH /api/admin/user-access': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { id, is_active } = await readBody(req);
    db.prepare('UPDATE users SET is_active=? WHERE id=?').run(is_active ? 1 : 0, id);
    logActivity('access_changed', `User #${id} access ${is_active ? 'ENABLED' : 'DISABLED'}`);
    send(res, 200, { ok: true });
  },

  // Delete a user account
  'POST /api/admin/delete-user': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { id } = await readBody(req);
    const target = db.prepare('SELECT role FROM users WHERE id=?').get(id);
    if (target && target.role === 'admin') return send(res, 400, { error: 'Cannot delete an admin account' });
    db.prepare('DELETE FROM users WHERE id=?').run(id);
    logActivity('user_deleted', `User #${id} deleted by admin`);
    send(res, 200, { ok: true });
  },

  // Admin: all applications & full lists for Main Control Center
  'GET /api/admin/all': async (req, res) => {
    if (!requireAdmin(req, res)) return;
    send(res, 200, { ok: true,
      bookings: db.prepare('SELECT * FROM bookings ORDER BY id DESC LIMIT 300').all(),
      applications: db.prepare('SELECT * FROM applications ORDER BY id DESC LIMIT 300').all(),
      mitra_applications: db.prepare('SELECT * FROM mitra_applications ORDER BY id DESC').all(),
      contacts: db.prepare('SELECT * FROM contacts ORDER BY id DESC LIMIT 100').all(),
      requests: db.prepare('SELECT * FROM service_requests ORDER BY id DESC LIMIT 100').all()
    });
  },

  // ══ LOCATIONS (public — powers dropdowns) ══
  'GET /api/locations': async (req, res) => {
    send(res, 200, { ok: true, locations: LOCATIONS, crops: CROP_TYPES, equipment: EQUIPMENT_TYPES, services: GOVT_SERVICES });
  },

  // ══ PROFILE update (user edits own details) ══
  'PATCH /api/my/profile': async (req, res) => {
    const u = requireLogin(req, res); if (!u) return;
    const { name, email, village, taluka, district, state } = await readBody(req);
    db.prepare(`UPDATE users SET name=COALESCE(?,name), email=COALESCE(?,email), village=COALESCE(?,village),
                taluka=COALESCE(?,taluka), district=COALESCE(?,district), state=COALESCE(?,state) WHERE id=?`)
      .run(name||null, email||null, village||null, taluka||null, district||null, state||null, u.id);
    const fresh = db.prepare('SELECT id,name,phone,email,role,village,taluka,district,state FROM users WHERE id=?').get(u.id);
    send(res, 200, { ok: true, user: fresh });
  },

  // ══ MITRA: find providers in same location ══
  'GET /api/mitra/providers': async (req, res) => {
    const u = requireRole(req, res, ['mitra']); if (!u) return;
    const sp = new URL(req.url, 'http://x').searchParams;
    const district = sp.get('district') || '';
    const state = sp.get('state') || '';
    let rows;
    if (district) rows = db.prepare("SELECT id,name,phone,village,taluka,district,state FROM users WHERE role='provider' AND is_active=1 AND district=?").all(district);
    else if (state) rows = db.prepare("SELECT id,name,phone,village,taluka,district,state FROM users WHERE role='provider' AND is_active=1 AND state=?").all(state);
    else rows = db.prepare("SELECT id,name,phone,village,taluka,district,state FROM users WHERE role='provider' AND is_active=1").all();
    send(res, 200, { ok: true, providers: rows });
  },

  // ══ MITRA: assign a provider to a booking ══
  'PATCH /api/mitra/assign-provider': async (req, res) => {
    const u = requireRole(req, res, ['mitra']); if (!u) return;
    const { booking_id, provider_id } = await readBody(req);
    db.prepare("UPDATE bookings SET provider_id=?, mitra_id=?, status='confirmed', updated_at=datetime('now','localtime') WHERE id=?")
      .run(provider_id, u.id, booking_id);
    logActivity('provider_assigned', `Mitra ${u.name}: booking #${booking_id} -> provider #${provider_id}`);
    send(res, 200, { ok: true });
  },

  // ══ PROVIDER: jobs assigned to me ══
  'GET /api/provider/jobs': async (req, res) => {
    const u = requireRole(req, res, ['provider']); if (!u) return;
    const rows = db.prepare("SELECT id, booking_ref, farmer_name, phone, village, district, equipment, booking_date, status, status_note FROM bookings WHERE provider_id=? ORDER BY id DESC").all(u.id);
    send(res, 200, { ok: true, jobs: rows });
  },

  'PATCH /api/provider/job-status': async (req, res) => {
    const u = requireRole(req, res, ['provider']); if (!u) return;
    const { id, status, note } = await readBody(req);
    const valid = ['confirmed','in_progress','completed','cancelled'];
    if (!valid.includes(status)) return send(res, 400, { error: 'Invalid status' });
    db.prepare("UPDATE bookings SET status=?, status_note=?, updated_at=datetime('now','localtime') WHERE id=? AND provider_id=?")
      .run(status, note||'', id, u.id);
    logActivity('provider_status', `Provider ${u.name}: booking #${id} -> ${status}`);
    send(res, 200, { ok: true });
  },

  // HEALTH ───────────────────────────────────────
  'GET /api/health': async (req, res) => {
    send(res, 200, { ok: true, service: 'iGram Digital API', time: new Date().toISOString() });
  }
};

// ── Dynamic routes (with params) ────────────────────────────────
async function dynamicRoutes(req, res, method, urlPath) {
  // GET /api/bookings/track/:ref
  let m = urlPath.match(/^\/api\/bookings\/track\/([\w-]+)$/);
  if (m && method === 'GET') {
    const b = db.prepare('SELECT booking_ref, equipment, booking_date, status, created_at FROM bookings WHERE booking_ref = ?')
      .get(m[1].toUpperCase());
    if (!b) return send(res, 404, { error: 'Booking not found. Check your reference number.' });
    return send(res, 200, { ok: true, booking: b });
  }

  // GET /api/applications/track/:ref
  m = urlPath.match(/^\/api\/applications\/track\/([\w-]+)$/);
  if (m && method === 'GET') {
    const a = db.prepare('SELECT app_ref, service, status, created_at FROM applications WHERE app_ref = ?')
      .get(m[1].toUpperCase());
    if (!a) return send(res, 404, { error: 'Application not found' });
    return send(res, 200, { ok: true, application: a });
  }

  // PATCH /api/bookings/:id/status
  m = urlPath.match(/^\/api\/bookings\/(\d+)\/status$/);
  if (m && method === 'PATCH') {
    if (!requireAdmin(req, res)) return true;
    const { status } = await readBody(req);
    if (!['pending','confirmed','completed','cancelled'].includes(status)) {
      return send(res, 400, { error: 'Invalid status' });
    }
    db.prepare('UPDATE bookings SET status=? WHERE id=?').run(status, Number(m[1]));
    logActivity('booking_status', `Booking #${m[1]} → ${status}`);
    return send(res, 200, { ok: true });
  }

  return false; // not handled
}

// ── HTTP server ─────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
    });
    return res.end();
  }

  try {
    // Exact-match API routes
    const handler = routes[`${req.method} ${urlPath}`];
    if (handler) return await handler(req, res);

    // GR-01 universal routes (with {id} params)
    const gr01 = matchGR01(req.method, urlPath);
    if (gr01) return await gr01.handler(req, res, gr01.params);

    // Param routes
    if (urlPath.startsWith('/api/')) {
      const handled = await dynamicRoutes(req, res, req.method, urlPath);
      if (handled !== false) return;
      return send(res, 404, { error: 'API endpoint not found' });
    }

    // Static frontend
    serveStatic(req, res, urlPath);
  } catch (e) {
    console.error('Server error:', e);
    send(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`
  ═══════════════════════════════════════════
  🚀 iGram Digital Hub — LIVE (zero deps)
  ═══════════════════════════════════════════
  Frontend : http://localhost:${PORT}
  API      : http://localhost:${PORT}/api/health
  Admin    : phone 8106442080 / igram@2025
  ═══════════════════════════════════════════`);
});

module.exports = server;
