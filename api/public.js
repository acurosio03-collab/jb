'use strict';
const L = require('./_lib');

module.exports = L.handler(async (req, res) => {
  if (req.method !== 'GET') throw new L.HttpError(405, 'Metode tidak diizinkan');
  const r = req.query.r;

  if (r === 'boot') {
    const settings = await L.getSettings();
    const s = await L.q(`SELECT count(*)::int AS available FROM accounts WHERE ${L.EFF_STATUS} = 'AVAILABLE'`);
    return L.send(res, 200, { settings, available: s[0].available, categories: L.CATEGORIES });
  }
  if (r === 'accounts') {
    const rows = await L.q(
      `SELECT id, name, price, description, images, ${L.EFF_STATUS} AS status
       FROM accounts WHERE status <> 'SOLD' ORDER BY created_at DESC`);
    return L.send(res, 200, { accounts: rows });
  }
  if (r === 'services') {
    const rows = await L.q(
      `SELECT id, category, name, price, description, image_id
       FROM services WHERE active = TRUE ORDER BY id`);
    return L.send(res, 200, { services: rows });
  }
  throw new L.HttpError(400, 'Permintaan tidak dikenal');
});
