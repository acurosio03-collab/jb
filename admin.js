(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app = $('#app');
  var S = { tab: 'dash', settings: {}, categories: [], accFilter: 'ALL', ordFilter: 'ALL' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rp(n) { return 'Rp' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function img(id) { return '/api/img?id=' + id; }
  function dt(s) { return new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); }
  function toast(msg, err) {
    var t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }
  function api(path, opt) {
    opt = opt || {};
    var o = { method: opt.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (opt.body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opt.body); }
    else if (o.method !== 'GET') { o.headers['Content-Type'] = 'application/json'; o.body = '{}'; }
    return fetch(path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401 && path.indexOf('/api/auth') !== 0) { start(); throw new Error('Sesi berakhir, login ulang'); }
        if (!r.ok) throw new Error(d.error || 'Terjadi kesalahan');
        return d;
      });
    });
  }
  function A(r, extra) { return '/api/admin?r=' + r + (extra || ''); }

  /* ---------- kompres foto di HP sebelum upload ---------- */
  function compress(file, maxDim, mime, quality) {
    return new Promise(function (resolve, reject) {
      var im = new Image(), url = URL.createObjectURL(file);
      im.onload = function () {
        var w = im.width, h = im.height, sc = Math.min(1, maxDim / Math.max(w, h));
        w = Math.round(w * sc); h = Math.round(h * sc);
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var x = c.getContext('2d');
        if (mime === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
        x.drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL(mime, quality));
      };
      im.onerror = function () { reject(new Error('Foto tidak bisa dibaca')); };
      im.src = url;
    });
  }
  function uploadFile(file, kind) {
    var png = kind === 'logo';
    return compress(file, png ? 600 : 1280, png ? 'image/png' : 'image/jpeg', 0.82)
      .then(function (data) { return api(A('upload'), { method: 'POST', body: { data: data } }); });
  }

  /* picker foto: ids = array id, max = jumlah maks. Mengembalikan {get()} */
  function picker(box, ids, max, kind) {
    var cur = ids.slice();
    function draw() {
      box.innerHTML = cur.map(function (id) {
        return '<div class="it"><img src="' + img(id) + '" alt=""><button type="button" data-rm="' + id + '">✕</button></div>';
      }).join('') + (cur.length < max ? '<button type="button" class="add" data-add>＋</button>' : '');
    }
    box.addEventListener('click', function (e) {
      var rm = e.target.getAttribute && e.target.getAttribute('data-rm');
      if (rm) { cur = cur.filter(function (i) { return i !== Number(rm); }); draw(); }
      if (e.target.hasAttribute && e.target.hasAttribute('data-add')) {
        var f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.multiple = max > 1;
        f.onchange = function () {
          var files = Array.prototype.slice.call(f.files).slice(0, max - cur.length);
          if (!files.length) return;
          toast('Mengunggah foto...');
          files.reduce(function (p, file) {
            return p.then(function () { return uploadFile(file, kind).then(function (d) { cur.push(d.id); draw(); }); });
          }, Promise.resolve()).catch(function (er) { toast(er.message, true); });
        };
        f.click();
      }
    });
    draw();
    return { get: function () { return cur.slice(); } };
  }

  /* ---------- sheet modal ---------- */
  function sheet(title, html) {
    var m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<div class="sheet"><div class="sheet-h"><h3>' + esc(title) + '</h3><button class="x" data-close>✕</button></div>' + html + '</div>';
    m.addEventListener('click', function (e) { if (e.target === m || e.target.hasAttribute('data-close')) m.remove(); });
    document.body.appendChild(m);
    return m;
  }

  /* ---------- login / setup ---------- */
  function start() {
    api('/api/auth').then(function (d) {
      if (d.loggedIn) return loadShell();
      if (d.needsSetup) return renderSetup(d.setupKeyConfigured);
      renderLogin();
    }).catch(function (e) { app.innerHTML = '<div class="login"><p class="s">' + esc(e.message) + '</p></div>'; });
  }
  function renderLogin() {
    app.innerHTML = '<form class="login" id="lf"><h1 class="orb">ARDZ ADMIN</h1><p class="s">Masuk untuk mengelola toko</p>' +
      '<div class="fg"><label>Username</label><input class="in" name="u" autocomplete="username" required></div>' +
      '<div class="fg"><label>Password</label><input class="in" type="password" name="p" autocomplete="current-password" required></div>' +
      '<div class="err-t" id="er"></div><button class="btn btn-p" style="width:100%">MASUK</button></form>';
    $('#lf').onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      api('/api/auth', { method: 'POST', body: { action: 'login', username: f.u.value, password: f.p.value } })
        .then(start).catch(function (er) { $('#er').textContent = er.message; });
    };
  }
  function renderSetup(keyOk) {
    app.innerHTML = '<form class="login" id="sf"><h1 class="orb">SETUP ADMIN</h1><p class="s">Buat akun admin pertama.' + (keyOk ? '' : ' <b style="color:#fca5a5">SETUP_KEY belum diatur di Vercel!</b>') + '</p>' +
      '<div class="fg"><label>Kunci Setup (SETUP_KEY dari Vercel)</label><input class="in" type="password" name="k" required></div>' +
      '<div class="fg"><label>Username</label><input class="in" name="u" autocomplete="username" required></div>' +
      '<div class="fg"><label>Password (min. 10 karakter)</label><input class="in" type="password" name="p" autocomplete="new-password" minlength="10" required></div>' +
      '<div class="err-t" id="er"></div><button class="btn btn-p" style="width:100%">BUAT ADMIN</button></form>';
    $('#sf').onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      api('/api/auth', { method: 'POST', body: { action: 'setup', setupKey: f.k.value, username: f.u.value, password: f.p.value } })
        .then(start).catch(function (er) { $('#er').textContent = er.message; });
    };
  }

  /* ---------- shell ---------- */
  function loadShell() {
    api(A('settings')).then(function (d) {
      S.settings = d.settings;
      app.innerHTML = '<div class="adm-top"><div class="wrap"><b class="orb">ARDZ ADMIN</b>' +
        '<div style="display:flex;gap:8px"><a class="btn btn-o btn-sm" href="/" target="_blank">Lihat Situs</a><button class="btn btn-bad btn-sm" id="lo">Keluar</button></div></div></div>' +
        '<div class="wrap"><div class="atabs" id="tabs"></div><div id="view" style="padding-bottom:60px"></div></div>';
      $('#lo').onclick = function () { api('/api/auth', { method: 'POST', body: { action: 'logout' } }).then(start); };
      $('#tabs').onclick = function (e) { var t = e.target.getAttribute('data-t'); if (t) { S.tab = t; show(); } };
      show();
    });
  }
  function show() {
    var tabs = [['dash', 'Dashboard'], ['acc', 'Akun'], ['svc', 'Jasa Posting'], ['ord', 'Pesanan'], ['set', 'Pengaturan']];
    $('#tabs').innerHTML = tabs.map(function (t) { return '<button data-t="' + t[0] + '" class="' + (S.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('');
    var v = $('#view'); v.innerHTML = '<p style="color:#a79bbd">Memuat...</p>';
    ({ dash: vDash, acc: vAcc, svc: vSvc, ord: vOrd, set: vSet })[S.tab](v);
  }
  function fail(e) { toast(e.message, true); }

  /* ---------- dashboard ---------- */
  function vDash(v) {
    api(A('stats')).then(function (d) {
      var s = d.stats;
      var items = [['Total stok akun', s.total], ['Stok tersedia', s.available], ['Sedang dipesan', s.reserved], ['Stok SOLD', s.sold],
        ['Paket jasa posting', s.services], ['Jumlah pesanan', s.orders], ['Pesanan menunggu', s.pending]];
      v.innerHTML = '<p style="color:#a79bbd;margin-bottom:12px">Halo, ' + esc(d.username) + '</p><div class="stats">' +
        items.map(function (i) { return '<div class="stat"><b>' + i[1] + '</b><span>' + i[0] + '</span></div>'; }).join('') + '</div>';
    }).catch(fail);
  }

  /* ---------- akun ---------- */
  function vAcc(v) {
    api(A('accounts')).then(function (d) {
      var l = d.accounts.filter(function (a) { return S.accFilter === 'ALL' || a.status === S.accFilter; });
      v.innerHTML = '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
        '<div class="tabs" style="margin:0" id="af">' + [['ALL', 'Semua'], ['AVAILABLE', 'Tersedia'], ['RESERVED', 'Dipesan'], ['SOLD', 'SOLD']].map(function (f) {
          return '<button data-f="' + f[0] + '" class="' + (S.accFilter === f[0] ? 'on' : '') + '">' + f[1] + '</button>';
        }).join('') + '</div><button class="btn btn-p btn-sm" id="addAcc">＋ Tambah Akun</button></div><div id="list"></div>';
      $('#list').innerHTML = l.length ? l.map(function (a) {
        var f = a.images && a.images[0];
        return '<div class="row"><div class="th">' + (f ? '<img src="' + img(f) + '" alt="">' : '') + '</div>' +
          '<div class="info"><h4>' + esc(a.name) + '</h4><small>' + rp(a.price) + '</small> <span class="pill ' + a.status + '">' + a.status + '</span></div>' +
          '<div class="ra"><button class="btn btn-o btn-sm" data-edit="' + a.id + '">Edit</button>' +
          (a.status === 'SOLD' ? '<button class="btn btn-p btn-sm" data-st="AVAILABLE" data-id="' + a.id + '">Aktifkan</button>'
            : '<button class="btn btn-wa btn-sm" data-st="SOLD" data-id="' + a.id + '">SOLD</button>') +
          '<button class="btn btn-bad btn-sm" data-del="' + a.id + '">Hapus</button></div></div>';
      }).join('') : '<div class="empty">Belum ada akun. Tekan “Tambah Akun”.</div>';
      $('#af').onclick = function (e) { var f = e.target.getAttribute('data-f'); if (f) { S.accFilter = f; show(); } };
      $('#addAcc').onclick = function () { accForm(null); };
      $('#list').onclick = function (e) {
        var t = e.target;
        if (t.getAttribute('data-edit')) accForm(d.accounts.filter(function (a) { return a.id === Number(t.getAttribute('data-edit')); })[0]);
        if (t.getAttribute('data-st')) {
          api(A('account-status'), { method: 'POST', body: { id: Number(t.getAttribute('data-id')), status: t.getAttribute('data-st') } })
            .then(function () { toast('Status diperbarui'); show(); }).catch(fail);
        }
        if (t.getAttribute('data-del') && confirm('Hapus akun ini permanen?')) {
          api(A('accounts', '&id=' + t.getAttribute('data-del')), { method: 'DELETE' }).then(function () { toast('Akun dihapus'); show(); }).catch(fail);
        }
      };
    }).catch(fail);
  }
  function accForm(a) {
    var m = sheet(a ? 'Edit Akun' : 'Tambah Akun',
      '<form id="f"><div class="fg"><label>Foto akun (maks. 6)</label><div class="pick" id="pk"></div></div>' +
      '<div class="fg"><label>Nama stok</label><input class="in" name="name" maxlength="80" placeholder="FF-001" required value="' + esc(a ? a.name : '') + '"></div>' +
      '<div class="fg"><label>Harga (Rp)</label><input class="in" name="price" type="number" min="0" inputmode="numeric" required value="' + (a ? a.price : '') + '"></div>' +
      '<div class="fg"><label>Keterangan</label><textarea class="in" name="description" maxlength="2000" placeholder="Akun Free Fire, detail bisa dilihat melalui foto dan deskripsi.">' + esc(a ? a.description : '') + '</textarea></div>' +
      '<button class="btn btn-p" style="width:100%">SIMPAN</button></form>');
    var pk = picker($('#pk', m), a ? a.images : [], 6, 'photo');
    $('#f', m).onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      var body = { name: f.name.value, price: Number(f.price.value), description: f.description.value, images: pk.get() };
      api(A('accounts', a ? '&id=' + a.id : ''), { method: a ? 'PUT' : 'POST', body: body })
        .then(function () { m.remove(); toast('Tersimpan'); show(); }).catch(fail);
    };
  }

  /* ---------- jasa ---------- */
  function vSvc(v) {
    api(A('services')).then(function (d) {
      S.categories = d.categories;
      v.innerHTML = '<div style="text-align:right;margin-bottom:12px"><button class="btn btn-p btn-sm" id="addS">＋ Tambah Jasa</button></div><div id="list"></div>';
      $('#list').innerHTML = d.services.length ? d.services.map(function (s) {
        return '<div class="row"><div class="th">' + (s.image_id ? '<img src="' + img(s.image_id) + '" alt="">' : '') + '</div>' +
          '<div class="info"><h4>' + esc(s.name) + '</h4><small>' + esc(s.category) + ' · ' + rp(s.price) + '</small> ' +
          (s.active ? '' : '<span class="pill SOLD">NONAKTIF</span>') + '</div>' +
          '<div class="ra"><button class="btn btn-o btn-sm" data-edit="' + s.id + '">Edit</button>' +
          '<button class="btn btn-bad btn-sm" data-del="' + s.id + '">Hapus</button></div></div>';
      }).join('') : '<div class="empty">Belum ada paket jasa.</div>';
      $('#addS').onclick = function () { svcForm(null); };
      $('#list').onclick = function (e) {
        var t = e.target;
        if (t.getAttribute('data-edit')) svcForm(d.services.filter(function (s) { return s.id === Number(t.getAttribute('data-edit')); })[0]);
        if (t.getAttribute('data-del') && confirm('Hapus paket jasa ini?')) {
          api(A('services', '&id=' + t.getAttribute('data-del')), { method: 'DELETE' }).then(function () { toast('Paket dihapus'); show(); }).catch(fail);
        }
      };
    }).catch(fail);
  }
  function svcForm(s) {
    var m = sheet(s ? 'Edit Jasa' : 'Tambah Jasa',
      '<form id="f"><div class="fg"><label>Foto / banner</label><div class="pick" id="pk"></div></div>' +
      '<div class="fg"><label>Kategori</label><select class="in" name="category">' +
      S.categories.map(function (c) { return '<option' + (s && s.category === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div class="fg"><label>Nama jasa</label><input class="in" name="name" maxlength="100" required value="' + esc(s ? s.name : '') + '"></div>' +
      '<div class="fg"><label>Harga (Rp)</label><input class="in" name="price" type="number" min="0" inputmode="numeric" required value="' + (s ? s.price : '') + '"></div>' +
      '<div class="fg"><label>Keterangan layanan</label><textarea class="in" name="description" maxlength="2000">' + esc(s ? s.description : '') + '</textarea></div>' +
      '<div class="fg"><label><input type="checkbox" name="active"' + (!s || s.active ? ' checked' : '') + '> Tampilkan di situs</label></div>' +
      '<button class="btn btn-p" style="width:100%">SIMPAN</button></form>');
    var pk = picker($('#pk', m), s && s.image_id ? [s.image_id] : [], 1, 'photo');
    $('#f', m).onsubmit = function (e) {
      e.preventDefault();
      var f = e.target, im = pk.get();
      var body = { category: f.category.value, name: f.name.value, price: Number(f.price.value), description: f.description.value, image_id: im[0] || null, active: f.active.checked };
      api(A('services', s ? '&id=' + s.id : ''), { method: s ? 'PUT' : 'POST', body: body })
        .then(function () { m.remove(); toast('Tersimpan'); show(); }).catch(fail);
    };
  }

  /* ---------- pesanan ---------- */
  function vOrd(v) {
    api(A('orders')).then(function (d) {
      var l = d.orders.filter(function (o) { return S.ordFilter === 'ALL' || o.status === S.ordFilter; });
      var num = S.settings.wa_number;
      v.innerHTML = '<div class="tabs" id="of">' + [['ALL', 'Semua'], ['PENDING', 'Menunggu'], ['DONE', 'Selesai'], ['CANCELLED', 'Batal']].map(function (f) {
        return '<button data-f="' + f[0] + '" class="' + (S.ordFilter === f[0] ? 'on' : '') + '">' + f[1] + '</button>';
      }).join('') + '</div><div id="list"></div>';
      $('#list').innerHTML = l.length ? l.map(function (o) {
        return '<div class="row" style="flex-wrap:wrap"><div class="info" style="min-width:60%"><h4>' + esc(o.product_name) + '</h4>' +
          '<small>' + (o.type === 'account' ? 'Akun' : 'Jasa') + ' · ' + rp(o.price) + ' · ' + dt(o.created_at) + '</small> <span class="pill ' + o.status + '">' + o.status + '</span></div>' +
          '<div class="ra"><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="https://wa.me/' + esc(num) + '?text=' + encodeURIComponent(o.wa_text) + '">WhatsApp</a>' +
          '<select class="in" style="width:auto;padding:6px 10px" data-os="' + o.id + '">' + ['PENDING', 'DONE', 'CANCELLED'].map(function (s) {
            return '<option' + (s === o.status ? ' selected' : '') + '>' + s + '</option>';
          }).join('') + '</select>' +
          '<button class="btn btn-bad btn-sm" data-del="' + o.id + '">Hapus</button></div></div>';
      }).join('') : '<div class="empty">Belum ada pesanan.</div>';
      $('#of').onclick = function (e) { var f = e.target.getAttribute('data-f'); if (f) { S.ordFilter = f; show(); } };
      $('#list').onchange = function (e) {
        var id = e.target.getAttribute('data-os');
        if (id) api(A('orders'), { method: 'PUT', body: { id: Number(id), status: e.target.value } }).then(function () { toast('Status pesanan diperbarui'); show(); }).catch(fail);
      };
      $('#list').onclick = function (e) {
        var id = e.target.getAttribute('data-del');
        if (id && confirm('Hapus data pesanan ini?')) api(A('orders', '&id=' + id), { method: 'DELETE' }).then(function () { show(); }).catch(fail);
      };
    }).catch(fail);
  }

  /* ---------- pengaturan ---------- */
  function vSet(v) {
    var s = S.settings;
    v.innerHTML = '<form id="f" style="max-width:560px">' +
      '<div class="fg"><label>Logo (PNG/JPG, tampil di navbar)</label><div class="pick" id="pl"></div></div>' +
      '<div class="fg"><label>Banner halaman utama</label><div class="pick" id="pb"></div></div>' +
      '<div class="fg"><label>Nama toko</label><input class="in" name="store_name" maxlength="60" value="' + esc(s.store_name) + '"></div>' +
      '<div class="fg"><label>Tagline</label><input class="in" name="tagline" maxlength="120" value="' + esc(s.tagline) + '"></div>' +
      '<div class="fg"><label>Judul banner</label><input class="in" name="banner_title" maxlength="120" value="' + esc(s.banner_title) + '"></div>' +
      '<div class="fg"><label>Subjudul banner</label><textarea class="in" name="banner_subtitle" maxlength="300" style="min-height:70px">' + esc(s.banner_subtitle) + '</textarea></div>' +
      '<div class="fg"><label>Nomor WhatsApp (format 62xxxxxxxxxx)</label><input class="in" name="wa_number" inputmode="numeric" value="' + esc(s.wa_number) + '"></div>' +
      '<div class="fg"><label>Tentang toko</label><textarea class="in" name="about" maxlength="1000">' + esc(s.about) + '</textarea></div>' +
      '<div class="fg"><label>Jam operasional</label><input class="in" name="hours" maxlength="200" value="' + esc(s.hours) + '"></div>' +
      '<div class="fg"><label>Instagram (tanpa @, opsional)</label><input class="in" name="instagram" maxlength="60" value="' + esc(s.instagram) + '"></div>' +
      '<button class="btn btn-p" style="width:100%">SIMPAN PENGATURAN</button></form>' +
      '<hr style="border-color:#2a1b47;margin:26px 0"><h3 class="orb" style="font-size:16px;margin-bottom:12px">Ganti Password</h3>' +
      '<form id="pf" style="max-width:560px"><div class="fg"><label>Password lama</label><input class="in" type="password" name="c" autocomplete="current-password" required></div>' +
      '<div class="fg"><label>Password baru (min. 10 karakter)</label><input class="in" type="password" name="n" minlength="10" autocomplete="new-password" required></div>' +
      '<button class="btn btn-o">Ganti Password</button></form>';
    var pl = picker($('#pl'), s.logo_image_id ? [Number(s.logo_image_id)] : [], 1, 'logo');
    var pb = picker($('#pb'), s.banner_image_id ? [Number(s.banner_image_id)] : [], 1, 'photo');
    $('#f').onsubmit = function (e) {
      e.preventDefault();
      var f = e.target, l = pl.get(), b = pb.get();
      var body = { store_name: f.store_name.value, tagline: f.tagline.value, banner_title: f.banner_title.value, banner_subtitle: f.banner_subtitle.value,
        wa_number: f.wa_number.value, about: f.about.value, hours: f.hours.value, instagram: f.instagram.value,
        logo_image_id: l[0] || '', banner_image_id: b[0] || '' };
      api(A('settings'), { method: 'PUT', body: body }).then(function (d) { S.settings = d.settings; toast('Pengaturan tersimpan'); }).catch(fail);
    };
    $('#pf').onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      api(A('password'), { method: 'POST', body: { current: f.c.value, next: f.n.value } })
        .then(function () { f.reset(); toast('Password diganti'); }).catch(fail);
    };
  }

  start();
})();
