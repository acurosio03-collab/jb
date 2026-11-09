'use strict';
const L = require('./_lib');

const MAX_B64 = 2300000; // ~1.7MB
function detectMime(buf) {
  if (buf.length > 12) {
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
    if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  }
  return null;
}
function imageIds(v, max) {
  if (!Array.isArray(v)) throw new L.HttpError(400, 'Daftar foto tidak valid');
  if (v.length > max) throw new L.HttpError(400, 'Maksimal ' + max + ' foto');
  return v.map(n => L.int(n, 1, 2147483647, 'ID foto'));
}
const PRICE_MAX = 2000000000;

module.exports = L.handler(async (req, res) => {
  const admin = await L.requireAdmin(req);
  if (req.method !== 'GET') L.checkOrigin(req);
  const r = req.query.r;
  const m = req.method;
  const qid = () => L.int(req.query.id, 1, 2147483647, 'ID');

  // ---------- statistik ----------
  if (r === 'stats' && m === 'GET') {
    const s = await L.q(`SELECT
      (SELECT count(*) FROM accounts)::int AS total,
      (SELECT count(*) FROM accounts WHERE ${L.EFF_STATUS}='AVAILABLE')::int AS available,
      (SELECT count(*) FROM accounts WHERE status='RESERVED' AND reserved_until >= now())::int AS reserved,
      (SELECT count(*) FROM accounts WHERE status='SOLD')::int AS sold,
      (SELECT count(*) FROM services)::int AS services,
      (SELECT count(*) FROM orders)::int AS orders,
      (SELECT count(*) FROM orders WHERE status='PENDING')::int AS pending`);
    return L.send(res, 200, { stats: s[0], username: admin.username });
  }

  // ---------- akun ----------
  if (r === 'accounts') {
    if (m === 'GET') {
      const rows = await L.q(`SELECT id, name, price, description, images, ${L.EFF_STATUS} AS status, created_at, sold_at
                              FROM accounts ORDER BY created_at DESC`);
      return L.send(res, 200, { accounts: rows });
    }
    if (m === 'POST' || m === 'PUT') {
      const b = L.body(req);
      const name = L.str(b.name, 80, 'Nama stok', true);
      const price = L.int(b.price, 0, PRICE_MAX, 'Harga');
      const description = L.str(b.description, 2000, 'Keterangan', false);
      const images = imageIds(b.images || [], 6);
      if (m === 'POST') {
        const x = await L.q('INSERT INTO accounts(name, price, description, images) VALUES ($1,$2,$3,$4::jsonb) RETURNING id',
          [name, price, description, JSON.stringify(images)]);
        return L.send(res, 200, { ok: true, id: x[0].id });
      }
      const id = qid();
      const old = await L.q('SELECT images FROM accounts WHERE id=$1', [id]);
      if (!old.length) throw new L.HttpError(404, 'Akun tidak ditemukan');
      await L.q('UPDATE accounts SET name=$1, price=$2, description=$3, images=$4::jsonb, updated_at=now() WHERE id=$5',
        [name, price, description, JSON.stringify(images), id]);
      await L.deleteImages((old[0].images || []).filter(i => !images.includes(i)));
      return L.send(res, 200, { ok: true });
    }
    if (m === 'DELETE') {
      const id = qid();
      const old = await L.q('DELETE FROM accounts WHERE id=$1 RETURNING images', [id]);
      if (!old.length) throw new L.HttpError(404, 'Akun tidak ditemukan');
      await L.deleteImages(old[0].images);
      return L.send(res, 200, { ok: true });
    }
  }
  if (r === 'account-status' && m === 'POST') {
    const b = L.body(req);
    const id = L.int(b.id, 1, 2147483647, 'ID');
    if (b.status === 'SOLD') {
      const x = await L.q("UPDATE accounts SET status='SOLD', sold_at=now(), reserved_until=NULL, updated_at=now() WHERE id=$1 RETURNING id", [id]);
      if (!x.length) throw new L.HttpError(404, 'Akun tidak ditemukan');
      await L.q("UPDATE orders SET status='DONE' WHERE type='account' AND ref_id=$1 AND status='PENDING'", [id]);
    } else if (b.status === 'AVAILABLE') {
      const x = await L.q("UPDATE accounts SET status='AVAILABLE', sold_at=NULL, reserved_until=NULL, updated_at=now() WHERE id=$1 RETURNING id", [id]);
      if (!x.length) throw new L.HttpError(404, 'Akun tidak ditemukan');
      await L.q("UPDATE orders SET status='CANCELLED' WHERE type='account' AND ref_id=$1 AND status='PENDING'", [id]);
    } else throw new L.HttpError(400, 'Status tidak valid');
    return L.send(res, 200, { ok: true });
  }

  // ---------- jasa ----------
  if (r === 'services') {
    if (m === 'GET') {
      const rows = await L.q('SELECT id, category, name, price, description, image_id, active, created_at FROM services ORDER BY id DESC');
      return L.send(res, 200, { services: rows, categories: L.CATEGORIES });
    }
    if (m === 'POST' || m === 'PUT') {
      const b = L.body(req);
      const category = L.str(b.category, 80, 'Kategori', true);
      if (!L.CATEGORIES.includes(category)) throw new L.HttpError(400, 'Kategori tidak valid');
      const name = L.str(b.name, 100, 'Nama jasa', true);
      const price = L.int(b.price, 0, PRICE_MAX, 'Harga');
      const description = L.str(b.description, 2000, 'Keterangan', false);
      const image_id = b.image_id ? L.int(b.image_id, 1, 2147483647, 'ID foto') : null;
      const active = b.active === false ? false : true;
      if (m === 'POST') {
        const x = await L.q('INSERT INTO services(category,name,price,description,image_id,active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
          [category, name, price, description, image_id, active]);
        return L.send(res, 200, { ok: true, id: x[0].id });
      }
      const id = qid();
      const old = await L.q('SELECT image_id FROM services WHERE id=$1', [id]);
      if (!old.length) throw new L.HttpError(404, 'Paket tidak ditemukan');
      await L.q('UPDATE services SET category=$1,name=$2,price=$3,description=$4,image_id=$5,active=$6 WHERE id=$7',
        [category, name, price, description, image_id, active, id]);
      if (old[0].image_id && old[0].image_id !== image_id) await L.deleteImages([old[0].image_id]);
      return L.send(res, 200, { ok: true });
    }
    if (m === 'DELETE') {
      const id = qid();
      const old = await L.q('DELETE FROM services WHERE id=$1 RETURNING image_id', [id]);
      if (!old.length) throw new L.HttpError(404, 'Paket tidak ditemukan');
      if (old[0].image_id) await L.deleteImages([old[0].image_id]);
      return L.send(res, 200, { ok: true });
    }
  }

  // ---------- pesanan ----------
  if (r === 'orders') {
    if (m === 'GET') {
      const rows = await L.q('SELECT id, type, ref_id, product_name, price, status, wa_text, created_at FROM orders ORDER BY id DESC LIMIT 300');
      return L.send(res, 200, { orders: rows });
    }
    if (m === 'PUT') {
      const b = L.body(req);
      const id = L.int(b.id, 1, 2147483647, 'ID');
      if (!['PENDING', 'DONE', 'CANCELLED'].includes(b.status)) throw new L.HttpError(400, 'Status tidak valid');
      const o = await L.q('UPDATE orders SET status=$1 WHERE id=$2 RETURNING type, ref_id', [b.status, id]);
      if (!o.length) throw new L.HttpError(404, 'Pesanan tidak ditemukan');
      if (o[0].type === 'account' && o[0].ref_id) {
        if (b.status === 'DONE') {
          await L.q("UPDATE accounts SET status='SOLD', sold_at=now(), reserved_until=NULL, updated_at=now() WHERE id=$1", [o[0].ref_id]);
        } else if (b.status === 'CANCELLED') {
          await L.q("UPDATE accounts SET status='AVAILABLE', reserved_until=NULL, updated_at=now() WHERE id=$1 AND status='RESERVED'", [o[0].ref_id]);
        }
      }
      return L.send(res, 200, { ok: true });
    }
    if (m === 'DELETE') {
      const id = qid();
      await L.q('DELETE FROM orders WHERE id=$1', [id]);
      return L.send(res, 200, { ok: true });
    }
  }

  // ---------- pengaturan ----------
  if (r === 'settings') {
    if (m === 'GET') return L.send(res, 200, { settings: await L.getSettings() });
    if (m === 'PUT') {
      const b = L.body(req);
      const cur = await L.getSettings();
      const next = {};
      if ('store_name' in b) next.store_name = L.str(b.store_name, 60, 'Nama toko', true);
      if ('tagline' in b) next.tagline = L.str(b.tagline, 120, 'Tagline', false);
      if ('banner_title' in b) next.banner_title = L.str(b.banner_title, 120, 'Judul banner', false);
      if ('banner_subtitle' in b) next.banner_subtitle = L.str(b.banner_subtitle, 300, 'Subjudul banner', false);
      if ('about' in b) next.about = L.str(b.about, 1000, 'Tentang toko', false);
      if ('hours' in b) next.hours = L.str(b.hours, 200, 'Jam operasional', false);
      if ('instagram' in b) next.instagram = L.str(b.instagram, 60, 'Instagram', false).replace(/^@/, '');
      if ('wa_number' in b) {
        let n = L.str(b.wa_number, 30, 'Nomor WhatsApp', true).replace(/\D/g, '');
        if (n.startsWith('0')) n = '62' + n.slice(1);
        if (n.length < 9 || n.length > 16) throw new L.HttpError(400, 'Nomor WhatsApp tidak valid');
        next.wa_number = n;
      }
      const toDelete = [];
      for (const k of ['logo_image_id', 'banner_image_id']) {
        if (k in b) {
          const v = b[k] === '' || b[k] === null ? '' : String(L.int(b[k], 1, 2147483647, 'ID foto'));
          next[k] = v;
          if (cur[k] && cur[k] !== v) toDelete.push(Number(cur[k]));
        }
      }
      for (const k of Object.keys(next)) {
        await L.q('INSERT INTO settings(key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', [k, next[k]]);
      }
      await L.deleteImages(toDelete);
      return L.send(res, 200, { ok: true, settings: await L.getSettings() });
    }
  }

  // ---------- upload foto ----------
  if (r === 'upload' && m === 'POST') {
    const b = L.body(req);
    const mt = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data || ''));
    if (!mt) throw new L.HttpError(400, 'Format foto tidak didukung (JPG/PNG/WEBP)');
    if (mt[1].length > MAX_B64) throw new L.HttpError(413, 'Ukuran foto terlalu besar');
    const buf = Buffer.from(mt[1], 'base64');
    const mime = detectMime(buf);
    if (!mime) throw new L.HttpError(400, 'File bukan gambar yang valid');
    const x = await L.q('INSERT INTO images(mime, data_b64) VALUES ($1,$2) RETURNING id', [mime, mt[1]]);
    return L.send(res, 200, { ok: true, id: x[0].id, url: '/api/img?id=' + x[0].id });
  }

  // ---------- ganti password ----------
  if (r === 'password' && m === 'POST') {
    const b = L.body(req);
    const cur = L.str(b.current, 100, 'Password lama', true);
    const nw = L.str(b.next, 100, 'Password baru', true);
    if (nw.length < 10) throw new L.HttpError(400, 'Password baru minimal 10 karakter');
    if (!(await L.bcrypt.compare(cur, admin.password_hash))) throw new L.HttpError(400, 'Password lama salah');
    const hash = await L.bcrypt.hash(nw, 12);
    await L.q('UPDATE admins SET password_hash=$1 WHERE id=$2', [hash, admin.id]);
    L.setSession(res, { id: admin.id, password_hash: hash });
    return L.send(res, 200, { ok: true });
  }

  throw new L.HttpError(404, 'Endpoint tidak ditemukan');
});
