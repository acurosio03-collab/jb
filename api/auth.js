'use strict';
const L = require('./_lib');

module.exports = L.handler(async (req, res) => {
  if (req.method === 'GET') {
    const a = await L.getAdmin(req);
    const c = await L.q('SELECT count(*)::int AS n FROM admins');
    return L.send(res, 200, {
      loggedIn: !!a,
      username: a ? a.username : null,
      needsSetup: c[0].n === 0,
      setupKeyConfigured: !!process.env.SETUP_KEY
    });
  }
  if (req.method !== 'POST') throw new L.HttpError(405, 'Metode tidak diizinkan');
  L.checkOrigin(req);
  const b = L.body(req);
  const ip = L.clientIp(req);

  if (b.action === 'logout') {
    L.clearSession(res);
    return L.send(res, 200, { ok: true });
  }

  if (b.action === 'setup') {
    const c = await L.q('SELECT count(*)::int AS n FROM admins');
    if (c[0].n > 0) throw new L.HttpError(403, 'Admin sudah dibuat');
    const key = process.env.SETUP_KEY;
    if (!key) throw new L.HttpError(500, 'SETUP_KEY belum diatur di Vercel');
    const given = Buffer.from(String(b.setupKey || ''));
    const real = Buffer.from(key);
    if (given.length !== real.length || !L.crypto.timingSafeEqual(given, real)) {
      throw new L.HttpError(403, 'Kunci setup salah');
    }
    const username = L.str(b.username, 40, 'Username', true);
    if (!/^[A-Za-z0-9_.-]{3,40}$/.test(username)) throw new L.HttpError(400, 'Username 3-40 karakter: huruf, angka, _ . -');
    const password = L.str(b.password, 100, 'Password', true);
    if (password.length < 10) throw new L.HttpError(400, 'Password minimal 10 karakter');
    const hash = await L.bcrypt.hash(password, 12);
    const r = await L.q('INSERT INTO admins(username, password_hash) VALUES ($1,$2) RETURNING id, username, password_hash', [username, hash]);
    L.setSession(res, r[0]);
    return L.send(res, 200, { ok: true });
  }

  if (b.action === 'login') {
    const fails = await L.q("SELECT count(*)::int AS n FROM login_attempts WHERE ip=$1 AND created_at > now() - interval '15 minutes'", [ip]);
    if (fails[0].n >= 8) throw new L.HttpError(429, 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.');
    const username = L.str(b.username, 40, 'Username', true);
    const password = L.str(b.password, 100, 'Password', true);
    const r = await L.q('SELECT id, username, password_hash FROM admins WHERE username=$1', [username]);
    const dummy = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5pQ1Qm7q0e1bq0m6a0ZyWZ4yQ1Xc1Ue';
    const ok = await L.bcrypt.compare(password, r.length ? r[0].password_hash : dummy);
    if (!r.length || !ok) {
      await L.q('INSERT INTO login_attempts(ip) VALUES ($1)', [ip]);
      await L.q("DELETE FROM login_attempts WHERE created_at < now() - interval '1 day'");
      throw new L.HttpError(401, 'Username atau password salah');
    }
    L.setSession(res, r[0]);
    return L.send(res, 200, { ok: true });
  }

  throw new L.HttpError(400, 'Aksi tidak dikenal');
});
