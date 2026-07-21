// ═══════════════════════════════════════════════════════════
// iGram GR-01 API layer — universal Customer + Service Request
// Operator model: Mitra creates customers and raises requests.
// Returns a routes object merged into server.js
// ═══════════════════════════════════════════════════════════
const { db, logActivity } = require('./database');

// ── ID generators (GR-01 naming: prefix + date + sequence) ──
function genId(prefix) {
  const d = new Date();
  const stamp = d.getFullYear().toString().slice(2) +
    String(d.getMonth()+1).padStart(2,'0') +
    String(d.getDate()).padStart(2,'0');
  const rnd = Math.floor(1000 + Math.random()*9000);
  return `${prefix}-${stamp}-${rnd}`;
}

// ── Universal lifecycle (GR-01 §11 / M08.1 §7) ──
const LIFECYCLE = ['DRAFT','SUBMITTED','VALIDATED','ASSIGNED','IN_PROGRESS',
  'AWAITING_CUSTOMER','AWAITING_PARTNER','COMPLETED','PAYMENT_PENDING','PAID','CLOSED'];
const EXCEPTIONS = ['REJECTED','CANCELLED','FAILED','REFUNDED','ESCALATED'];
const ALL_STATUSES = [...LIFECYCLE, ...EXCEPTIONS];

// ── Audit helper ──
function audit(eventCode, actor, entity, entityId, detail) {
  db.prepare(`INSERT INTO System_Audit_Log (event_code, actor_id, actor_role, entity, entity_id, detail)
              VALUES (?,?,?,?,?,?)`)
    .run(eventCode, actor ? actor.id : null, actor ? actor.role : null, entity || '', String(entityId||''), detail||'');
}

// ── Fire n8n/AI-agent webhooks (non-blocking, never crashes the request) ──
function fireWebhook(event_code, payload) {
  try {
    const hooks = db.prepare("SELECT url FROM Integration_Webhook WHERE is_active=1 AND (event_code=? OR event_code='*')").all(event_code);
    for (const h of hooks) {
      fetch(h.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: event_code, at: new Date().toISOString(), data: payload })
      }).catch(() => {});
    }
  } catch (e) { /* webhooks must never break the API */ }
}

// role helpers passed in from server (send, readBody, getUser)
function buildGR01Routes({ send, readBody, getUser }) {

  // Role hierarchy (GR-01 §RBAC): user < mitra/provider < hub_manager < admin(HQ)
  const ROLE_LEVEL = { user: 0, provider: 1, mitra: 1, hub_manager: 2, admin: 3 };

  // Operator = any staff role (not customer). Admin always allowed.
  function requireOperator(req, res) {
    const u = getUser(req);
    if (!u) { send(res, 401, { error: 'Login required' }); return null; }
    if (u.role === 'user') { send(res, 403, { error: 'Operator access only' }); return null; }
    return u;
  }

  // Hub Manager or above
  function requireHub(req, res) {
    const u = getUser(req);
    if (!u) { send(res, 401, { error: 'Login required' }); return null; }
    if ((ROLE_LEVEL[u.role] || 0) < 2) { send(res, 403, { error: 'Hub Manager access only' }); return null; }
    return u;
  }
  function requireAdminRole(req, res) {
    const u = getUser(req);
    if (!u) { send(res, 401, { error: 'Login required' }); return null; }
    if (u.role !== 'admin') { send(res, 403, { error: 'Admin only' }); return null; }
    return u;
  }

  return {

    // ═══ CATALOGUE ═══
    'GET /api/services': async (req, res) => {
      const rows = db.prepare('SELECT service_code, name, category, is_active FROM Service_Catalogue WHERE is_active=1 ORDER BY category, service_code').all();
      send(res, 200, { ok: true, services: rows });
    },

    // ═══ CUSTOMER 360 ═══
    'GET /api/customers': async (req, res) => {
      const u = requireOperator(req, res); if (!u) return;
      const q = new URL(req.url, 'http://x').searchParams.get('query') || '';
      let rows;
      if (q) {
        const like = '%' + q + '%';
        rows = db.prepare(`SELECT * FROM Customer_Master WHERE name LIKE ? OR phone LIKE ? OR Customer_ID LIKE ? OR village LIKE ? ORDER BY created_at DESC LIMIT 100`).all(like, like, like, like);
      } else {
        rows = db.prepare('SELECT * FROM Customer_Master ORDER BY created_at DESC LIMIT 100').all();
      }
      send(res, 200, { ok: true, customers: rows });
    },

    'POST /api/customers': async (req, res) => {
      const u = requireOperator(req, res); if (!u) return;
      let { name, phone, email, gender, village, taluka, district, state, language, hub_id } = await readBody(req);
      if (!name || !phone) return send(res, 400, { error: 'name and phone are required' });
      phone = String(phone).replace(/[^0-9]/g,'');
      if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
      if (phone.length !== 10) return send(res, 400, { error: 'Enter a valid 10-digit mobile number' });
      const existing = db.prepare('SELECT Customer_ID FROM Customer_Master WHERE phone=?').get(phone);
      if (existing) return send(res, 409, { error: 'Customer already exists', Customer_ID: existing.Customer_ID });
      const cid = genId('CUST');
      db.prepare(`INSERT INTO Customer_Master (Customer_ID,name,phone,email,gender,village,taluka,district,state,language,hub_id,created_by)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(cid, name, phone, email||null, gender||null, village||null, taluka||null, district||null, state||null, language||'English', hub_id||null, u.id);
      audit('CRM-002', u, 'Customer', cid, `Registered ${name}`);
      fireWebhook('CUSTOMER_CREATED', { Customer_ID: cid, name, phone, district, state, by: u.name });
      send(res, 200, { ok: true, Customer_ID: cid, message: `Customer ${cid} registered` });
    },

    'GET /api/customers/{id}': async (req, res, params) => {
      const u = requireOperator(req, res); if (!u) return;
      const cust = db.prepare('SELECT * FROM Customer_Master WHERE Customer_ID=?').get(params.id);
      if (!cust) return send(res, 404, { error: 'Customer not found' });
      const requests = db.prepare('SELECT * FROM Service_Request_Master WHERE Customer_ID=? ORDER BY created_at DESC').all(params.id);
      send(res, 200, { ok: true, customer: cust, requests });
    },

    // ═══ UNIVERSAL SERVICE REQUEST ═══
    'POST /api/service-requests': async (req, res) => {
      const u = requireOperator(req, res); if (!u) return;
      const { Customer_ID, service_code, title, priority, amount, notes, detail } = await readBody(req);
      if (!Customer_ID || !service_code) return send(res, 400, { error: 'Customer_ID and service_code required' });
      const cust = db.prepare('SELECT * FROM Customer_Master WHERE Customer_ID=?').get(Customer_ID);
      if (!cust) return send(res, 404, { error: 'Customer not found' });
      const svc = db.prepare('SELECT * FROM Service_Catalogue WHERE service_code=?').get(service_code);
      if (!svc) return send(res, 400, { error: 'Unknown service_code' });
      const rid = genId('REQ');
      db.prepare(`INSERT INTO Service_Request_Master
        (Request_ID,Customer_ID,service_code,category,title,status,priority,hub_id,district,state,assigned_mitra,amount,notes,created_by,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))`)
        .run(rid, Customer_ID, service_code, svc.category, title||svc.name, 'SUBMITTED', priority||'Normal',
             cust.hub_id||null, cust.district||null, cust.state||null, u.id, amount||0, notes||'', u.id);
      if (detail) db.prepare('INSERT INTO Service_Request_Detail (Request_ID, detail_json) VALUES (?,?)').run(rid, JSON.stringify(detail));
      db.prepare('INSERT INTO Request_Status_History (Request_ID, from_status, to_status, note, changed_by) VALUES (?,?,?,?,?)')
        .run(rid, 'DRAFT', 'SUBMITTED', 'Created by operator', u.id);
      audit('CORE-001', u, 'ServiceRequest', rid, `${svc.name} for ${cust.name}`);
      fireWebhook('REQUEST_CREATED', { Request_ID: rid, service_code, service: svc.name, category: svc.category, customer: cust.name, phone: cust.phone, district: cust.district, amount: amount||0, detail: detail||null, by: u.name });
      send(res, 200, { ok: true, Request_ID: rid, status: 'SUBMITTED', message: `Request ${rid} created` });
    },

    'GET /api/service-requests': async (req, res) => {
      const u = requireOperator(req, res); if (!u) return;
      const sp = new URL(req.url, 'http://x').searchParams;
      const status = sp.get('status'); const category = sp.get('category');
      let sql = `SELECT r.*, c.name AS customer_name, c.phone AS customer_phone
                 FROM Service_Request_Master r JOIN Customer_Master c ON r.Customer_ID=c.Customer_ID`;
      const where = []; const args = [];
      // Mitra sees own district; admin sees all
      if (u.role !== 'admin') {
        const me = db.prepare('SELECT district FROM users WHERE id=?').get(u.id);
        if (me && me.district) { where.push('(r.district=? OR r.district IS NULL)'); args.push(me.district); }
      }
      if (status) { where.push('r.status=?'); args.push(status); }
      if (category) { where.push('r.category=?'); args.push(category); }
      if (where.length) sql += ' WHERE ' + where.join(' AND ');
      sql += ' ORDER BY r.created_at DESC LIMIT 300';
      send(res, 200, { ok: true, requests: db.prepare(sql).all(...args), lifecycle: ALL_STATUSES });
    },

    'GET /api/service-requests/{id}': async (req, res, params) => {
      const u = requireOperator(req, res); if (!u) return;
      const r = db.prepare('SELECT * FROM Service_Request_Master WHERE Request_ID=?').get(params.id);
      if (!r) return send(res, 404, { error: 'Request not found' });
      const cust = db.prepare('SELECT * FROM Customer_Master WHERE Customer_ID=?').get(r.Customer_ID);
      const detail = db.prepare('SELECT detail_json FROM Service_Request_Detail WHERE Request_ID=? ORDER BY Request_Detail_ID DESC LIMIT 1').get(params.id);
      const history = db.prepare('SELECT * FROM Request_Status_History WHERE Request_ID=? ORDER BY id').all(params.id);
      send(res, 200, { ok: true, request: r, customer: cust, detail: detail ? JSON.parse(detail.detail_json) : null, history });
    },

    // Update status (universal lifecycle)
    'PATCH /api/service-requests/{id}/status': async (req, res, params) => {
      const u = requireOperator(req, res); if (!u) return;
      const { status, note } = await readBody(req);
      if (!ALL_STATUSES.includes(status)) return send(res, 400, { error: 'Invalid status. Allowed: ' + ALL_STATUSES.join(', ') });
      const r = db.prepare('SELECT status FROM Service_Request_Master WHERE Request_ID=?').get(params.id);
      if (!r) return send(res, 404, { error: 'Request not found' });
      db.prepare("UPDATE Service_Request_Master SET status=?, updated_at=datetime('now','localtime') WHERE Request_ID=?").run(status, params.id);
      db.prepare('INSERT INTO Request_Status_History (Request_ID, from_status, to_status, note, changed_by) VALUES (?,?,?,?,?)')
        .run(params.id, r.status, status, note||'', u.id);
      audit('STATUS-UPD', u, 'ServiceRequest', params.id, `${r.status} -> ${status}`);
      fireWebhook('STATUS_CHANGED', { Request_ID: params.id, from: r.status, to: status, note: note||'', by: u.name });
      send(res, 200, { ok: true });
    },

    // Assign a partner/provider
    'PATCH /api/service-requests/{id}/assign': async (req, res, params) => {
      const u = requireOperator(req, res); if (!u) return;
      const { partner_id } = await readBody(req);
      db.prepare("UPDATE Service_Request_Master SET assigned_partner=?, status='ASSIGNED', updated_at=datetime('now','localtime') WHERE Request_ID=?").run(partner_id, params.id);
      db.prepare('INSERT INTO Request_Status_History (Request_ID, to_status, note, changed_by) VALUES (?,?,?,?)')
        .run(params.id, 'ASSIGNED', 'Partner assigned', u.id);
      audit('ASSIGN', u, 'ServiceRequest', params.id, `Assigned partner ${partner_id}`);
      send(res, 200, { ok: true });
    },

    // ═══ PAYMENTS (shared Payment_Master) ═══
    'POST /api/payments': async (req, res) => {
      const u = requireOperator(req, res); if (!u) return;
      const { Request_ID, Customer_ID, amount, method } = await readBody(req);
      if (!amount) return send(res, 400, { error: 'amount required' });
      const pid = genId('PAY');
      db.prepare(`INSERT INTO Payment_Master (Payment_ID,Request_ID,Customer_ID,amount,method,collected_by)
                  VALUES (?,?,?,?,?,?)`).run(pid, Request_ID||null, Customer_ID||null, amount, method||'Cash', u.id);
      if (Request_ID) db.prepare("UPDATE Service_Request_Master SET payment_status='PAID', status='PAID', updated_at=datetime('now','localtime') WHERE Request_ID=?").run(Request_ID);
      audit('PAY-001', u, 'Payment', pid, `₹${amount} via ${method||'Cash'}`);
      fireWebhook('PAYMENT_COLLECTED', { Payment_ID: pid, Request_ID: Request_ID||null, amount, method: method||'Cash', by: u.name });
      send(res, 200, { ok: true, Payment_ID: pid, message: `Payment ${pid} collected` });
    },

    // ═══ DASHBOARD SUMMARY ═══
    'GET /api/dashboard/summary': async (req, res) => {
      const u = requireOperator(req, res); if (!u) return;
      const cnt = (sql, ...a) => Number(db.prepare(sql).get(...a).c);
      const byStatus = db.prepare('SELECT status, COUNT(*) c FROM Service_Request_Master GROUP BY status').all();
      send(res, 200, { ok: true, summary: {
        total_customers: cnt('SELECT COUNT(*) c FROM Customer_Master'),
        total_requests: cnt('SELECT COUNT(*) c FROM Service_Request_Master'),
        open_requests: cnt("SELECT COUNT(*) c FROM Service_Request_Master WHERE status NOT IN ('CLOSED','COMPLETED','PAID','CANCELLED','REJECTED')"),
        completed: cnt("SELECT COUNT(*) c FROM Service_Request_Master WHERE status IN ('COMPLETED','PAID','CLOSED')"),
        revenue: cnt("SELECT COALESCE(SUM(amount),0) c FROM Payment_Master"),
        by_status: byStatus
      }});
    },

    // ═══ HUB MANAGER — team & hub overview ═══
    'GET /api/hub/overview': async (req, res) => {
      const u = requireHub(req, res); if (!u) return;
      const me = db.prepare('SELECT district, state FROM users WHERE id=?').get(u.id);
      const dist = me ? me.district : null;
      const team = dist
        ? db.prepare("SELECT id,name,phone,role,village,district,is_active FROM users WHERE role IN ('mitra','provider') AND district=? ORDER BY role,name").all(dist)
        : db.prepare("SELECT id,name,phone,role,village,district,is_active FROM users WHERE role IN ('mitra','provider') ORDER BY role,name").all();
      const reqs = dist
        ? db.prepare("SELECT status, COUNT(*) c FROM Service_Request_Master WHERE district=? GROUP BY status").all(dist)
        : db.prepare('SELECT status, COUNT(*) c FROM Service_Request_Master GROUP BY status').all();
      const payments = dist
        ? Number(db.prepare("SELECT COALESCE(SUM(p.amount),0) c FROM Payment_Master p LEFT JOIN Service_Request_Master r ON p.Request_ID=r.Request_ID WHERE r.district=? OR p.Request_ID IS NULL").get(dist).c)
        : Number(db.prepare('SELECT COALESCE(SUM(amount),0) c FROM Payment_Master').get().c);
      send(res, 200, { ok: true, hub_district: dist, team, request_summary: reqs, revenue: payments });
    },

    // Hub Manager: escalate / approve a request
    'PATCH /api/hub/requests/{id}/decision': async (req, res, params) => {
      const u = requireHub(req, res); if (!u) return;
      const { decision, note } = await readBody(req); // APPROVED | REJECTED | ESCALATED
      const map = { APPROVED: 'VALIDATED', REJECTED: 'REJECTED', ESCALATED: 'ESCALATED' };
      const to = map[decision];
      if (!to) return send(res, 400, { error: 'decision must be APPROVED, REJECTED or ESCALATED' });
      const r = db.prepare('SELECT status FROM Service_Request_Master WHERE Request_ID=?').get(params.id);
      if (!r) return send(res, 404, { error: 'Request not found' });
      db.prepare("UPDATE Service_Request_Master SET status=?, updated_at=datetime('now','localtime') WHERE Request_ID=?").run(to, params.id);
      db.prepare('INSERT INTO Request_Status_History (Request_ID, from_status, to_status, note, changed_by) VALUES (?,?,?,?,?)')
        .run(params.id, r.status, to, note || ('Hub decision: ' + decision), u.id);
      audit('HUB-DEC', u, 'ServiceRequest', params.id, decision);
      fireWebhook('HUB_DECISION', { Request_ID: params.id, decision, note: note||'', by: u.name });
      send(res, 200, { ok: true, status: to });
    },

    // ═══ HQ ADMIN — n8n webhook management ═══
    'GET /api/admin/webhooks': async (req, res) => {
      const u = requireAdminRole(req, res); if (!u) return;
      send(res, 200, { ok: true, webhooks: db.prepare('SELECT * FROM Integration_Webhook ORDER BY id DESC').all(),
        events: ['*','CUSTOMER_CREATED','REQUEST_CREATED','STATUS_CHANGED','PAYMENT_COLLECTED','HUB_DECISION'] });
    },

    'POST /api/admin/webhooks': async (req, res) => {
      const u = requireAdminRole(req, res); if (!u) return;
      const { event_code, url } = await readBody(req);
      if (!event_code || !url) return send(res, 400, { error: 'event_code and url required' });
      if (!/^https?:\/\//.test(url)) return send(res, 400, { error: 'url must start with http:// or https://' });
      const r = db.prepare('INSERT INTO Integration_Webhook (event_code, url) VALUES (?,?)').run(event_code, url);
      audit('HOOK-ADD', u, 'Webhook', String(r.lastInsertRowid), `${event_code} -> ${url}`);
      send(res, 200, { ok: true, id: Number(r.lastInsertRowid) });
    },

    'PATCH /api/admin/webhooks/{id}': async (req, res, params) => {
      const u = requireAdminRole(req, res); if (!u) return;
      const { is_active } = await readBody(req);
      db.prepare('UPDATE Integration_Webhook SET is_active=? WHERE id=?').run(is_active ? 1 : 0, params.id);
      send(res, 200, { ok: true });
    },

    'DELETE /api/admin/webhooks/{id}': async (req, res, params) => {
      const u = requireAdminRole(req, res); if (!u) return;
      db.prepare('DELETE FROM Integration_Webhook WHERE id=?').run(params.id);
      send(res, 200, { ok: true });
    },

    // Test-fire a webhook event manually (for n8n workflow testing)
    'POST /api/admin/webhooks/test': async (req, res) => {
      const u = requireAdminRole(req, res); if (!u) return;
      const { event_code } = await readBody(req);
      fireWebhook(event_code || 'TEST', { message: 'Test event from iGram', fired_by: u.name });
      send(res, 200, { ok: true, message: 'Test event fired to all matching webhooks' });
    },

    // ═══ AUDIT LOG (admin) ═══
    'GET /api/admin/audit': async (req, res) => {
      const u = requireAdminRole(req, res); if (!u) return;
      send(res, 200, { ok: true, audit: db.prepare('SELECT * FROM System_Audit_Log ORDER BY Audit_ID DESC LIMIT 100').all() });
    }
  };
}

module.exports = { buildGR01Routes, genId, ALL_STATUSES, audit };
