// Minimal JWT (HS256) using Node built-in crypto — zero dependencies
const crypto = require('crypto');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64urlJSON(obj) { return b64url(JSON.stringify(obj)); }

function sign(payload, secret, opts = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now()/1000) + (opts.expiresInSec || 7*24*3600);
  const body = { ...payload, exp };
  const data = b64urlJSON(header) + '.' + b64urlJSON(body);
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  return data + '.' + sig;
}

function verify(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const data = parts[0] + '.' + parts[1];
  const expected = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  const a = Buffer.from(parts[2]); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Bad signature');
  const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString());
  if (payload.exp && payload.exp < Math.floor(Date.now()/1000)) throw new Error('Token expired');
  return payload;
}

module.exports = { sign, verify };
