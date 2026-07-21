// ═══════════════════════════════════════════════════════
// iGram Digital — API Test Suite
// Run: npm test   (server must NOT be running — tests start their own)
// ═══════════════════════════════════════════════════════
const { spawn } = require('child_process');
const path = require('path');

const BASE = 'http://localhost:3477';
let passed = 0, failed = 0, server;

function check(name, cond, info = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${info}`); }
}

async function api(method, url, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers.Authorization = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + url, opts);
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function run() {
  console.log('\n═══ iGram Digital — API Tests ═══\n');

  // ── 1. Health check ─────────────────────────
  console.log('▶ Health');
  let r = await api('GET', '/api/health');
  check('GET /api/health returns ok', r.status === 200 && r.data.ok === true);

  // ── 2. Public forms (no account) ────────────
  console.log('▶ Public Request & Contact (no login)');
  r = await api('POST', '/api/requests', { name: 'Walk-in Visitor', phone: '9000000010', service: 'AgriUber — Equipment Booking', message: 'Need tractor info' });
  check('POST /api/requests works without login', r.status === 200 && r.data.ok);
  check('Request gets RQ- reference', /^RQ-\d{4}-\d{4}$/.test(r.data.req_ref || ''));

  r = await api('POST', '/api/contact', { name: 'Visitor', phone: '9000000011', message: 'Hello iGram' });
  check('POST /api/contact works without login', r.status === 200 && r.data.ok);

  r = await api('POST', '/api/contact', { name: 'X' });
  check('Contact rejects missing message', r.status === 400);

  // ── 2b. Services REQUIRE login ──────────────
  console.log('▶ Services require account');
  r = await api('POST', '/api/bookings', { name: 'NoLogin', phone: '9', equipment: 'Tractor', date: '2026-07-01' });
  check('Booking blocked without login (401)', r.status === 401);

  r = await api('POST', '/api/applications', { name: 'NoLogin', phone: '9', service: 'PM-Kisan' });
  check('Application blocked without login (401)', r.status === 401);

  r = await api('POST', '/api/farmers', { name: 'NoLogin', phone: '9' });
  check('Farmer reg blocked without login (401)', r.status === 401);

  // Create a service user account
  const svcPhone = '8' + String(Date.now()).slice(-9);
  r = await api('POST', '/api/auth/register', { name: 'Service User', phone: svcPhone, password: 'svc12345', role: 'user' });
  check('Service user registered', r.status === 200 && !!r.data.token);
  const svcToken = r.data.token;

  // ── 2c. Booking flow (logged in) ────────────
  console.log('▶ AgriUber bookings (logged in)');
  r = await api('POST', '/api/bookings', {
    name: 'Test Farmer', phone: '9000000001', village: 'Testpalli',
    taluka: 'Nalgonda', equipment: 'Tractor', date: '2026-07-01',
    land: '5 acres', crop: 'Paddy', language: 'Telugu'
  }, svcToken);
  check('POST /api/bookings creates booking (with login)', r.status === 200 && r.data.ok);
  check('Booking gets AG- reference', /^AG-\d{4}-\d{4}$/.test(r.data.booking_ref || ''));
  const bookingRef = r.data.booking_ref;

  r = await api('POST', '/api/bookings', { name: 'X' }, svcToken);
  check('POST /api/bookings rejects missing fields', r.status === 400);

  r = await api('GET', '/api/bookings/track/' + bookingRef);
  check('GET /api/bookings/track/:ref finds booking', r.status === 200 && r.data.booking.booking_ref === bookingRef);

  r = await api('GET', '/api/bookings/track/AG-0000-0000');
  check('Track unknown ref returns 404', r.status === 404);

  // ── 3. Farmer & owner registration ──────────
  console.log('▶ Registrations');
  r = await api('POST', '/api/farmers', { name: 'Ravi Test', phone: '9000000002', village: 'Testpalli' }, svcToken);
  check('POST /api/farmers works (with login)', r.status === 200 && r.data.ok);

  r = await api('POST', '/api/owners', { name: 'Owner Test', phone: '9000000003', machineType: 'Tractor', rate: 250 }, svcToken);
  check('POST /api/owners works (with login)', r.status === 200 && r.data.ok);

  r = await api('POST', '/api/owners', { name: 'NoMachine' }, svcToken);
  check('POST /api/owners rejects missing machineType', r.status === 400);

  // ── 4. iGovt applications ───────────────────
  console.log('▶ iGovt applications');
  r = await api('POST', '/api/applications', {
    name: 'Priya Test', phone: '9000000004', village: 'Testpalli',
    district: 'Warangal', service: 'PM-Kisan Registration'
  }, svcToken);
  check('POST /api/applications creates application', r.status === 200 && r.data.ok);
  check('Application gets GV- reference', /^GV-\d{4}-\d{4}$/.test(r.data.app_ref || ''));
  const appRef = r.data.app_ref;

  r = await api('GET', '/api/applications/track/' + appRef);
  check('Track application works', r.status === 200 && r.data.application.app_ref === appRef);

  // ── 5. Mitra application ────────────────────
  console.log('▶ Mitra applications');
  r = await api('POST', '/api/mitra/apply', { name: 'Mitra Test', phone: '9000000005', village: 'Testpalli', state: 'Telangana' });
  check('POST /api/mitra/apply works', r.status === 200 && r.data.ok);

  // ── 6. Auth flow ────────────────────────────
  console.log('▶ Authentication');
  const uniquePhone = '9' + String(Date.now()).slice(-9);
  r = await api('POST', '/api/auth/register', { name: 'Auth Test', phone: uniquePhone, password: 'test1234', role: 'user' });
  check('POST /api/auth/register works', r.status === 200 && !!r.data.token);

  r = await api('POST', '/api/auth/register', { name: 'Dup', phone: uniquePhone, password: 'test1234' });
  check('Duplicate phone rejected (409)', r.status === 409);

  r = await api('POST', '/api/auth/login', { phone: uniquePhone, password: 'test1234' });
  check('POST /api/auth/login works', r.status === 200 && !!r.data.token);
  const userToken = r.data.token;

  r = await api('POST', '/api/auth/login', { phone: uniquePhone, password: 'wrong' });
  check('Wrong password rejected (401)', r.status === 401);

  r = await api('GET', '/api/auth/me', null, userToken);
  check('GET /api/auth/me returns profile', r.status === 200 && r.data.user.phone === uniquePhone);

  // ── 6b. My data endpoints ───────────────────
  console.log('▶ My bookings/applications');
  r = await api('GET', '/api/my/bookings', null, svcToken);
  check('GET /api/my/bookings returns own bookings', r.status === 200 && r.data.bookings.length >= 1);

  r = await api('GET', '/api/my/applications', null, svcToken);
  check('GET /api/my/applications works', r.status === 200 && Array.isArray(r.data.applications));

  // Admin can see contacts/requests
  // (tested after admin login below)

  // ── 7. Admin protected routes ───────────────
  console.log('▶ Admin protection');
  r = await api('GET', '/api/bookings');
  check('GET /api/bookings blocked without token (401)', r.status === 401);

  r = await api('GET', '/api/bookings', null, userToken);
  check('GET /api/bookings blocked for normal user (403)', r.status === 403);

  r = await api('POST', '/api/auth/login', { phone: '8106442080', password: process.env.ADMIN_PASSWORD || 'igram@2025' });
  check('Admin login works', r.status === 200 && r.data.user.role === 'admin');
  const adminToken = r.data.token;

  r = await api('GET', '/api/bookings', null, adminToken);
  check('Admin can list bookings', r.status === 200 && Array.isArray(r.data.bookings));

  r = await api('GET', '/api/admin/stats', null, adminToken);
  check('Admin stats endpoint works', r.status === 200 && typeof r.data.stats.total_bookings === 'number');
  check('Stats count our test booking', r.data.stats.total_bookings >= 1);

  r = await api('GET', '/api/admin/activity', null, adminToken);
  check('Admin activity log works', r.status === 200 && Array.isArray(r.data.activity));

  r = await api('GET', '/api/contacts', null, adminToken);
  check('Admin can list contact messages', r.status === 200 && r.data.contacts.length >= 1);

  r = await api('GET', '/api/requests', null, adminToken);
  check('Admin can list service requests', r.status === 200 && r.data.requests.length >= 1);

  // ── 8. Booking status update (admin) ────────
  console.log('▶ Status updates');
  const allBookings = (await api('GET', '/api/bookings', null, adminToken)).data.bookings;
  const firstId = allBookings[0].id;
  r = await api('PATCH', `/api/bookings/${firstId}/status`, { status: 'confirmed' }, adminToken);
  check('Admin can update booking status', r.status === 200);

  r = await api('PATCH', `/api/bookings/${firstId}/status`, { status: 'invalid-status' }, adminToken);
  check('Invalid status rejected (400)', r.status === 400);

  // ── 10. Phone validation + OTP ──────────────
  console.log('\u25B6 Phone validation & OTP');
  r = await api('POST', '/api/auth/register', { name: 'Bad', phone: '123', password: 'test1234', role: 'user' });
  check('Register rejects short phone (400)', r.status === 400);

  r = await api('POST', '/api/auth/register', { name: 'Norm', phone: '+91 98765 11111', password: 'test1234', role: 'user' });
  check('Register normalizes +91 phone', r.status === 200 && r.data.user.phone === '9876511111');

  r = await api('POST', '/api/auth/send-otp', { phone: '9876511111' });
  check('Send OTP returns demo code', r.status === 200 && /^\d{6}$/.test(r.data.demo_code || ''));
  const otpCode = r.data.demo_code;

  r = await api('POST', '/api/auth/verify-otp', { phone: '9876511111', code: otpCode });
  check('Verify OTP logs in', r.status === 200 && !!r.data.token);

  r = await api('POST', '/api/auth/verify-otp', { phone: '9876511111', code: '000000' });
  check('Wrong OTP rejected', r.status === 401);

  // ── 11. Mitra pipeline ──────────────────────
  console.log('\u25B6 Mitra status pipeline');
  const mitraPhone = '7' + String(Date.now()).slice(-9);
  r = await api('POST', '/api/auth/register', { name: 'Mitra Test', phone: mitraPhone, password: 'mitra1234', role: 'mitra' });
  const mitraToken = r.data.token;
  check('Mitra registered', r.status === 200 && r.data.user.role === 'mitra');

  r = await api('GET', '/api/mitra/queue', null, mitraToken);
  check('Mitra sees work queue', r.status === 200 && Array.isArray(r.data.bookings));

  if (r.data.bookings.length) {
    const bkId = r.data.bookings[0].id;
    r = await api('PATCH', '/api/mitra/booking-status', { id: bkId, status: 'in_progress', note: 'Working on it' }, mitraToken);
    check('Mitra updates booking status', r.status === 200);
  }

  r = await api('GET', '/api/mitra/queue', null, svcToken);
  check('Non-mitra blocked from queue (403)', r.status === 403);

  // ── 12. Documents ───────────────────────────
  console.log('\u25B6 Documents');
  r = await api('POST', '/api/my/documents', { doc_name: 'aadhaar.pdf', doc_type: 'application/pdf' }, svcToken);
  check('Upload document works', r.status === 200);
  r = await api('GET', '/api/my/documents', null, svcToken);
  check('List my documents works', r.status === 200 && r.data.documents.length >= 1);

  // ── 13. Admin access control ────────────────
  console.log('\u25B6 Admin access control');
  r = await api('GET', '/api/admin/users?role=user', null, adminToken);
  check('Admin lists users by role', r.status === 200 && Array.isArray(r.data.users));
  const someUser = r.data.users.find(u => u.role === 'user');
  if (someUser) {
    r = await api('PATCH', '/api/admin/user-access', { id: someUser.id, is_active: 0 }, adminToken);
    check('Admin disables user access', r.status === 200);
    r = await api('POST', '/api/auth/login', { phone: someUser.phone, password: 'test1234' });
    check('Disabled user cannot login (403)', r.status === 403 || r.status === 401);
    r = await api('PATCH', '/api/admin/user-access', { id: someUser.id, is_active: 1 }, adminToken);
    check('Admin re-enables access', r.status === 200);
  }

  r = await api('PATCH', '/api/admin/user-access', { id: 1, is_active: 0 }, svcToken);
  check('Non-admin blocked from access control (403)', r.status === 403);

    // ── 14. Location workflow ───────────────────
  console.log('\u25B6 Location-based workflow');
  let lr = await api('GET', '/api/locations');
  check('GET /api/locations returns data', lr.status === 200 && !!lr.data.locations.Telangana);
  check('Locations include crops & equipment', lr.data.crops.length > 0 && lr.data.equipment.length > 0);

  // Hyderabad user + booking
  const hyU = '6' + String(Date.now()).slice(-9);
  let lw = await api('POST', '/api/auth/register', { name: 'Hyd U', phone: hyU, password: 'pass1234', role: 'user', district: 'Hyderabad', state: 'Telangana' });
  const hyUTok = lw.data.token;
  lw = await api('POST', '/api/bookings', { name: 'Hyd U', phone: hyU, equipment: 'Tractor', date: '2026-08-01', district: 'Hyderabad', state: 'Telangana' }, hyUTok);
  check('Location booking created', lw.status === 200 && !!lw.data.booking_ref);

  // providers in two districts
  const hyP = '6' + String(Date.now()+1).slice(-9);
  await api('POST', '/api/auth/register', { name: 'Hyd P', phone: hyP, password: 'pass1234', role: 'provider', district: 'Hyderabad', state: 'Telangana' });
  const wgP = '6' + String(Date.now()+2).slice(-9);
  await api('POST', '/api/auth/register', { name: 'Wgl P', phone: wgP, password: 'pass1234', role: 'provider', district: 'Warangal', state: 'Telangana' });

  // mitra in Hyderabad
  const hyM = '6' + String(Date.now()+3).slice(-9);
  lw = await api('POST', '/api/auth/register', { name: 'Hyd M', phone: hyM, password: 'pass1234', role: 'mitra', district: 'Hyderabad', state: 'Telangana' });
  const hyMTok = lw.data.token;

  lw = await api('GET', '/api/mitra/providers?district=Hyderabad', null, hyMTok);
  check('Mitra sees Hyderabad providers only', lw.status === 200 && lw.data.providers.every(p => p.district === 'Hyderabad'));

  lw = await api('GET', '/api/mitra/queue', null, hyMTok);
  check('Mitra queue filtered to district', lw.status === 200 && lw.data.my_district === 'Hyderabad');
  const hyBk = lw.data.bookings[0];

  if (hyBk) {
    const hyProviders = (await api('GET', '/api/mitra/providers?district=Hyderabad', null, hyMTok)).data.providers;
    lw = await api('PATCH', '/api/mitra/assign-provider', { booking_id: hyBk.id, provider_id: hyProviders[0].id }, hyMTok);
    check('Mitra assigns provider', lw.status === 200);

    // provider sees the job
    lw = await api('POST', '/api/auth/login', { phone: hyP, password: 'pass1234' });
    const hyPTok = lw.data.token;
    lw = await api('GET', '/api/provider/jobs', null, hyPTok);
    check('Provider sees assigned job', lw.status === 200 && lw.data.jobs.length >= 1);

    lw = await api('PATCH', '/api/provider/job-status', { id: hyBk.id, status: 'completed', note: 'Done' }, hyPTok);
    check('Provider completes job', lw.status === 200);

    lw = await api('GET', '/api/my/bookings', null, hyUTok);
    check('User sees completed status', lw.data.bookings[0].status === 'completed');
  }

  // Profile update
  lw = await api('PATCH', '/api/my/profile', { village: 'Updated Village', district: 'Hyderabad' }, hyUTok);
  check('Profile update works', lw.status === 200 && lw.data.user.village === 'Updated Village');

    // ── 15. GR-01 Universal Operator Backend ────
  console.log('\u25B6 GR-01 universal backend');
  // operator (mitra) token already exists? create fresh
  const opPhone = '5' + String(Date.now()).slice(-9);
  let g = await api('POST', '/api/auth/register', { name: 'GR01 Mitra', phone: opPhone, password: 'op123456', role: 'mitra', district: 'Hyderabad', state: 'Telangana' });
  const opTok = g.data.token;
  check('Operator registered', g.status === 200);

  g = await api('GET', '/api/services', null, opTok);
  check('Service catalogue loads (30 services)', g.status === 200 && g.data.services.length >= 30);

  g = await api('POST', '/api/customers', { name: 'GR01 Cust', phone: '9' + String(Date.now()).slice(-9), village: 'Kukatpally', district: 'Hyderabad', state: 'Telangana' }, opTok);
  check('Customer_Master create', g.status === 200 && /^CUST-\d{6}-\d{4}$/.test(g.data.Customer_ID));
  const custId = g.data.Customer_ID;

  g = await api('POST', '/api/service-requests', { Customer_ID: custId, service_code: 'HLT-01', title: 'Consult', amount: 100, detail: { symptom: 'fever' } }, opTok);
  check('Universal Service_Request create', g.status === 200 && /^REQ-\d{6}-\d{4}$/.test(g.data.Request_ID));
  const reqId = g.data.Request_ID;
  check('New request status = SUBMITTED', g.data.status === 'SUBMITTED');

  g = await api('PATCH', '/api/service-requests/' + reqId + '/status', { status: 'IN_PROGRESS', note: 'assigned' }, opTok);
  check('Lifecycle status update', g.status === 200);

  g = await api('PATCH', '/api/service-requests/' + reqId + '/status', { status: 'NOT_A_STATUS' }, opTok);
  check('Invalid status rejected', g.status === 400);

  g = await api('GET', '/api/service-requests/' + reqId, null, opTok);
  check('Request detail + history', g.status === 200 && g.data.history.length >= 2 && g.data.detail.symptom === 'fever');

  g = await api('POST', '/api/payments', { Request_ID: reqId, Customer_ID: custId, amount: 100, method: 'Cash' }, opTok);
  check('Payment_Master collect', g.status === 200 && /^PAY-\d{6}-\d{4}$/.test(g.data.Payment_ID));

  g = await api('GET', '/api/dashboard/summary', null, opTok);
  check('Dashboard summary', g.status === 200 && g.data.summary.total_customers >= 1);

  g = await api('GET', '/api/customers', null, svcToken);
  check('Customer role blocked from operator API', g.status === 403);

  g = await api('GET', '/api/admin/audit', null, adminToken);
  check('Admin audit log', g.status === 200 && Array.isArray(g.data.audit));

    // ── 16. Hub Manager + n8n Webhooks ──────────
  console.log('\u25B6 Hub Manager & webhooks');
  const hmPhone = '4' + String(Date.now()).slice(-9);
  let h = await api('POST', '/api/auth/register', { name: 'Hub Mgr', phone: hmPhone, password: 'hub12345', role: 'hub_manager', district: 'Hyderabad', state: 'Telangana' });
  check('Hub Manager registered', h.status === 200 && h.data.user.role === 'hub_manager');
  const hubTok = h.data.token;

  h = await api('GET', '/api/hub/overview', null, hubTok);
  check('Hub overview loads', h.status === 200 && Array.isArray(h.data.team));

  h = await api('GET', '/api/hub/overview', null, svcToken);
  check('Customer blocked from hub API', h.status === 403);

  h = await api('POST', '/api/admin/webhooks', { event_code: 'REQUEST_CREATED', url: 'https://example.com/webhook/x' }, adminToken);
  check('HQ adds webhook', h.status === 200 && h.data.id > 0);
  const whId = h.data.id;

  h = await api('POST', '/api/admin/webhooks', { event_code: 'X', url: 'not-a-url' }, adminToken);
  check('Bad webhook URL rejected', h.status === 400);

  h = await api('GET', '/api/admin/webhooks', null, adminToken);
  check('HQ lists webhooks', h.status === 200 && h.data.webhooks.some(w => w.id === whId));

  h = await api('PATCH', '/api/admin/webhooks/' + whId, { is_active: 0 }, adminToken);
  check('HQ disables webhook', h.status === 200);

  h = await api('DELETE', '/api/admin/webhooks/' + whId, null, adminToken);
  check('HQ deletes webhook', h.status === 200);

  h = await api('GET', '/api/admin/webhooks', null, hubTok);
  check('Hub Manager blocked from HQ webhooks', h.status === 403);

    // ── 9. Frontend served ──────────────────────
  console.log('▶ Frontend serving');
  const home = await fetch(BASE + '/');
  const homeHtml = await home.text();
  check('Homepage served', home.status === 200 && homeHtml.includes('iGram'));

  const agri = await fetch(BASE + '/agriuber.html');
  check('AgriUber page served', agri.status === 200);

  // ── Summary ─────────────────────────────────
  console.log(`\n═══ RESULTS: ${passed} passed, ${failed} failed ═══\n`);
  process.exit(failed > 0 ? 1 : 0);
}

// ── Boot test server on port 3477 with a clean DB ───────
const fs = require('fs');
const testDb = path.join(__dirname, '..', 'igram.db');
// NOTE: tests run against the same DB file; in CI you may want a fresh copy.

server = spawn('node', [path.join(__dirname, '..', 'server.js')], {
  env: { ...process.env, PORT: 3477 },
  stdio: 'ignore'
});

setTimeout(() => {
  run().catch(e => { console.error('Test runner crashed:', e); process.exit(1); })
    .finally(() => server.kill());
}, 1500);

process.on('exit', () => { try { server.kill(); } catch {} });
