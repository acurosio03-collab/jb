'use strict';
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const SCHEMA = require('./_schema');

const CATEGORIES = [
  'Jasa posting akun Free Fire',
  'Jasa promosi akun',
  'Jasa posting jual beli akun',
  'Jasa promosi story',
  'Paket promosi lainnya'
];
const COOKIE = 'ards_session';
const SESSION_DAYS = 7;
const RESERVE_MINUTES = parseInt(process.env.RESERVE_MINUTES || '15', 10);

// Status efektif: reservasi yang sudah kedaluwarsa dianggap AVAILABLE lagi.
const EFF_STATUS = `CASE WHEN status='RESERVED' AND reserved_until < now() THEN 'AVAILABLE' ELSE status END`;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

let client = null;
let schemaOk = false;

function sql() {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum diatur di Vercel');
    client = neon(process.env.DATABASE_URL);
  }
  return client;
}
async function q(text, params) { return sql().query(text, params || []); }

async function ensureSchema() {
  if (schemaOk) return;
  const r = await q("SELECT to_regclass('public.orders') AS t");
  if (!r[0].t) {
    for (const s of SCHEMA) {
      try { await q(s); } catch (e) { if (!/already exists|duplicate/i.test(String(e.message))) throw e; }
    }
  }
  schemaOk = true;
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function handler(fn) {
  return async (req, res) => {
    try {
      await ensureSchema();
      await fn(req, res);
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      if (!res.headersSent) {
        send(res, e instanceof HttpError ? e.status : 500,
          { error: e instanceof HttpError ? e.message : 'Terjadi kesalahan pada server' });
      }
    }
  };
}

// ---------- validasi ----------
function str(v, max, label, required) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') throw new HttpError(400, label + ' tidak valid');
  v = v.trim();
  if (required && !v) throw new HttpError(400, label + ' wajib diisi');
  if (v.length > max) throw new HttpError(400, label + ' maksimal ' + max + ' karakter');
  return v;
}
function int(v, min, max, label) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, label + ' tidak valid');
  }
  return n;
}
function body(req) {
  if (!req.body || typeof req.body !== 'object') throw new HttpError(400, 'Data tidak valid');
  return req.body;
}
function clientIp(req) {
  const f = req.headers['x-forwarded-for'];
  return (f ? String(f).split(',')[0] : req.socket && req.socket.remoteAddress || 'unknown').trim().slice(0, 64);
}
function checkOrigin(req) {
  const o = req.headers.origin;
  if (o) {
    let host;
    try { host = new URL(o).host; } catch (e) { throw new HttpError(403, 'Origin tidak valid'); }
    if (host !== req.headers.host) throw new HttpError(403, 'Permintaan ditolak');
  }
  const ct = String(req.headers['content-type'] || '');
  if (!/application\/json/i.test(ct)) throw new HttpError(415, 'Content-Type harus JSON');
}

// ---------- session ----------
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET belum diatur / kurang dari 32 karakter');
  return s;
}
function signToken(payload) {
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const h = crypto.createHmac('sha256', secret()).update(b).digest('base64url');
  return b + '.' + h;
}
function verifyToken(t) {
  if (!t || typeof t !== 'string' || t.indexOf('.') < 0) return null;
  const [b, h] = t.split('.');
  const exp = crypto.createHmac('sha256', secret()).update(b).digest('base64url');
  const a1 = Buffer.from(h), a2 = Buffer.from(exp);
  if (a1.length !== a2.length || !crypto.timingSafeEqual(a1, a2)) return null;
  try {
    const p = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (!p.exp || p.exp < Date.now()) return null;
    return p;
  } catch (e) { return null; }
}
function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function setSession(res, admin) {
  const payload = { id: admin.id, v: admin.password_hash.slice(-12), exp: Date.now() + SESSION_DAYS * 864e5 };
  res.setHeader('Set-Cookie',
    `${COOKIE}=${signToken(payload)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}`);
}
function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}
async function getAdmin(req) {
  const p = verifyToken(parseCookies(req)[COOKIE]);
  if (!p) return null;
  const r = await q('SELECT id, username, password_hash FROM admins WHERE id=$1', [p.id]);
  if (!r.length || r[0].password_hash.slice(-12) !== p.v) return null;
  return r[0];
}
async function requireAdmin(req) {
  const a = await getAdmin(req);
  if (!a) throw new HttpError(401, 'Silakan login terlebih dahulu');
  return a;
}

// ---------- pengaturan & util ----------
async function getSettings() {
  const rows = await q('SELECT key, value FROM settings');
  const o = {};
  rows.forEach(r => { o[r.key] = r.value; });
  return o;
}
function rupiah(n) { return 'Rp' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function waUrl(number, text) {
  return 'https://wa.me/' + String(number).replace(/\D/g, '') + '?text=' + encodeURIComponent(text);
}
function waAccountText(a) {
  return 'Halo ARDZ STORE, saya ingin membeli akun Free Fire.\n\n' +
    'Nama stok: ' + a.name + '\nHarga: ' + rupiah(a.price) + '\nKeterangan: ' + (a.description || '-') +
    '\n\nApakah stok masih tersedia?';
}
function waServiceText(s) {
  return 'Halo ARDZ STORE, saya ingin memesan jasa posting.\n\n' +
    'Nama jasa: ' + s.name + '\nHarga: ' + rupiah(s.price) + '\n\nMohon informasi selanjutnya.';
}
async function deleteImages(ids) {
  ids = (ids || []).map(Number).filter(n => Number.isInteger(n) && n > 0);
  if (ids.length) await q('DELETE FROM images WHERE id = ANY($1::int[])', [ids]);
}

module.exports = {
  CATEGORIES, EFF_STATUS, RESERVE_MINUTES, HttpError, q, send, handler, str, int, body,
  clientIp, checkOrigin, setSession, clearSession, getAdmin, requireAdmin, getSettings,
  waUrl, waAccountText, waServiceText, rupiah, deleteImages, bcrypt, crypto
};
