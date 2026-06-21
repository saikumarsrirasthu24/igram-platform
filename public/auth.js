// ═══ iGram Auth — shared client library (single source of truth) ═══
const IGRAM_DASHBOARDS = {
  user:     'user-dashboard.html',
  mitra:    'mitra-portal.html',
  provider: 'provider-portal.html',
  admin:    'admin-erp.html'
};

function igramUser() {
  try { return JSON.parse(localStorage.getItem('igram_user') || 'null'); } catch { return null; }
}
function igramToken() { return localStorage.getItem('igram_token') || ''; }
function igramSaveSession(token, user) {
  localStorage.setItem('igram_token', token);
  localStorage.setItem('igram_user', JSON.stringify(user));
}
function igramLogout() {
  localStorage.removeItem('igram_token');
  localStorage.removeItem('igram_user');
  window.location.href = 'signin.html';
}

// Guard a dashboard page. Redirects to signin if not logged in or wrong role.
function igramRequireRole(role) {
  const u = igramUser();
  const t = igramToken();
  if (!t || !u) {
    window.location.replace('signin.html?next=' + encodeURIComponent(location.pathname.split('/').pop()) + '&role=' + role);
    return null;
  }
  if (u.role !== role && u.role !== 'admin') {
    // logged in but wrong portal — send them to their own
    window.location.replace(IGRAM_DASHBOARDS[u.role] || 'signin.html');
    return null;
  }
  return u;
}

// Authenticated fetch — attaches the SAME localStorage token. No re-login prompts.
async function igramApi(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  const t = igramToken();
  if (t) opts.headers.Authorization = 'Bearer ' + t;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  let json = {};
  try { json = await res.json(); } catch {}
  if (res.status === 401) {
    igramLogout();
    throw new Error('Session expired. Please sign in again.');
  }
  if (res.status === 403) {
    throw new Error(json.error || 'Access denied');
  }
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}
