'use strict';
const L = require('./_lib');

module.exports = L.handler(async (req, res) => {
  if (req.method !== 'POST') throw new L.HttpError(405, 'Metode tidak diizinkan');
  L.checkOrigin(req);
  const b = L.body(req);
  const ip = L.clientIp(req);
  const id = L.int(b.id, 1, 2147483647, 'ID');

  const recent = await L.q("SELECT count(*)::int AS n FROM orders WHERE ip=$1 AND created_at > now() - interval '1 hour'", [ip]);
  if (recent[0].n >= 15) throw new L.HttpError(429, 'Terlalu banyak pesanan. Coba lagi nanti.');

  const settings = await L.getSettings();
  let order, text;

  if (b.type === 'account') {
    // Satu statement atomik: hanya satu pembeli yang bisa memenangkan stok yang sama.
    const r = await L.q(
      `WITH r AS (
         UPDATE accounts
            SET status='RESERVED',
                reserved_until = now() + make_interval(mins => $3),
                updated_at = now()
          WHERE id = $1
            AND (status='AVAILABLE' OR (status='RESERVED' AND reserved_until < now()))
        RETURNING id, name, price, description
       )
       INSERT INTO orders(type, ref_id, product_name, price, description, status, ip)
       SELECT 'account', id, name, price, description, 'PENDING', $2 FROM r
       RETURNING id, ref_id, product_name AS name, price, description`,
      [id, ip, L.RESERVE_MINUTES]);
    if (!r.length) throw new L.HttpError(409, 'Maaf, akun ini sudah dipesan atau terjual.');
    order = r[0];
    text = L.waAccountText(order);
  } else if (b.type === 'service') {
    const r = await L.q(
      `INSERT INTO orders(type, ref_id, product_name, price, description, status, ip)
       SELECT 'service', id, name, price, description, 'PENDING', $2 FROM services WHERE id=$1 AND active=TRUE
       RETURNING id, ref_id, product_name AS name, price, description`,
      [id, ip]);
    if (!r.length) throw new L.HttpError(404, 'Paket jasa tidak ditemukan');
    order = r[0];
    text = L.waServiceText(order);
  } else {
    throw new L.HttpError(400, 'Jenis pesanan tidak valid');
  }

  await L.q('UPDATE orders SET wa_text=$1 WHERE id=$2', [text, order.id]);
  L.send(res, 200, { ok: true, orderId: order.id, wa: L.waUrl(settings.wa_number, text) });
});
