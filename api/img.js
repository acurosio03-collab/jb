'use strict';
const L = require('./_lib');

module.exports = async (req, res) => {
  try {
    const id = parseInt(req.query.id, 10);
    if (!Number.isInteger(id) || id < 1) { res.statusCode = 404; return res.end(); }
    const r = await L.q('SELECT mime, data_b64 FROM images WHERE id=$1', [id]);
    if (!r.length) { res.statusCode = 404; return res.end(); }
    res.statusCode = 200;
    res.setHeader('Content-Type', r[0].mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(Buffer.from(r[0].data_b64, 'base64'));
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end();
  }
};
