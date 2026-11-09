(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var S = { settings: {}, accounts: [], services: [], categories: [], cat: null };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rp(n) { return 'Rp' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function img(id) { return '/api/img?id=' + id; }

  function toast(msg, err) {
    var t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3800);
  }

  function api(path, opt) {
    opt = opt || {};
    var o = { method: opt.method || 'GET', headers: {} };
    if (opt.body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opt.body); }
    return fetch(path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.error || 'Terjadi kesalahan'); e.status = r.status; throw e; }
        return d;
      });
    });
  }

  /* ---------- pengaturan tampilan ---------- */
  function applySettings() {
    var s = S.settings, name = s.store_name || 'ARDZ STORE';
    document.title = name + ' — ' + (s.tagline || '');
    var logoSrc = s.logo_image_id ? img(s.logo_image_id) : '/logo.jpg';
    var logo = s.logo_image_id
      ? '<img src="' + logoSrc + '" alt="' + esc(name) + '">'
      : '<img src="' + logoSrc + '" alt="' + esc(name) + '" style="border-radius:8px"><span>' + esc(name) + '</span>';
    $('#brand').innerHTML = logo;
    $('#favicon').href = logoSrc;
    $('#heroLogo').src = logoSrc;
    $('#heroTitle').innerHTML = esc(s.banner_title || name);
    $('#heroSub').textContent = s.banner_subtitle || '';
    var hero = $('#hero');
    if (s.banner_image_id) hero.style.backgroundImage = 'url(' + img(s.banner_image_id) + ')';
    $('#footName').textContent = name;
    $('#footName2').textContent = name;
    $('#footTag').textContent = s.tagline || '';
    $('#yr').textContent = new Date().getFullYear();
    $('#aboutTxt').textContent = s.about || '';
    $('#hoursTxt').textContent = s.hours || '-';
    $('#waTxt').textContent = '+' + (s.wa_number || '');
    var wa = 'https://wa.me/' + (s.wa_number || '') + '?text=' + encodeURIComponent('Halo ' + name + ', saya ingin bertanya.');
    $('#contactWA').href = wa;
    $('#fab').href = wa;
    if (s.instagram) {
      $('#igRow').classList.remove('hide');
      $('#igLink').textContent = '@' + s.instagram;
      $('#igLink').href = 'https://instagram.com/' + encodeURIComponent(s.instagram);
    }
  }

  /* ---------- kartu akun ---------- */
  function accountCard(a, i) {
    var first = a.images && a.images[0];
    var res = a.status === 'RESERVED';
    return '<article class="card" style="animation-delay:' + (i % 8) * 40 + 'ms">' +
      '<div class="ph" data-detail="' + a.id + '">' +
      (first ? '<img loading="lazy" src="' + img(first) + '" alt="' + esc(a.name) + '">' : '<div class="noimg">Foto belum tersedia</div>') +
      '<span class="badge ' + (res ? 'res' : '') + '">' + (res ? 'DIPESAN' : 'AVAILABLE') + '</span></div>' +
      '<div class="cb"><h3>' + esc(a.name) + '</h3><div class="price">' + rp(a.price) + '</div>' +
      '<p class="desc">' + esc(a.description || 'Akun Free Fire, detail bisa dilihat melalui foto dan deskripsi.') + '</p>' +
      '<div class="acts"><button class="btn btn-o btn-sm" data-detail="' + a.id + '">Detail</button>' +
      '<button class="btn btn-wa btn-sm" data-buy="' + a.id + '"' + (res ? ' disabled' : '') + '>' +
      (res ? 'SEDANG DIPESAN' : 'BELI VIA WHATSAPP') + '</button></div></div></article>';
  }
  function emptyBox(t) { return '<div class="empty" style="grid-column:1/-1">' + t + '</div>'; }

  function renderLatest() {
    var l = S.accounts.slice(0, 6);
    $('#latest').innerHTML = l.length ? l.map(accountCard).join('') : emptyBox('Belum ada stok akun saat ini. Cek lagi nanti ya!');
  }
  function renderCatalog() {
    var q = $('#search').value.trim().toLowerCase(), so = $('#sort').value;
    var l = S.accounts.filter(function (a) { return !q || (a.name + ' ' + a.description).toLowerCase().indexOf(q) > -1; });
    if (so === 'low') l.sort(function (a, b) { return a.price - b.price; });
    if (so === 'high') l.sort(function (a, b) { return b.price - a.price; });
    $('#katInfo').textContent = S.accounts.length + ' akun tersedia';
    $('#catalog').innerHTML = l.length ? l.map(accountCard).join('') : emptyBox('Tidak ada akun yang cocok.');
  }
  function renderCount() {
    var n = S.accounts.filter(function (a) { return a.status === 'AVAILABLE'; }).length;
    $('#stokCount').textContent = n;
  }

  /* ---------- jasa ---------- */
  function renderServices() {
    var cats = S.categories.filter(function (c) { return S.services.some(function (s) { return s.category === c; }); });
    if (!S.cat || cats.indexOf(S.cat) < 0) S.cat = 'ALL';
    var tabs = ['ALL'].concat(cats);
    $('#svcTabs').innerHTML = tabs.map(function (c) {
      return '<button data-cat="' + esc(c) + '" class="' + (c === S.cat ? 'on' : '') + '">' + (c === 'ALL' ? 'Semua' : esc(c)) + '</button>';
    }).join('');
    var l = S.services.filter(function (s) { return S.cat === 'ALL' || s.category === S.cat; });
    $('#services').innerHTML = l.length ? l.map(function (s, i) {
      return '<article class="card" style="animation-delay:' + (i % 8) * 40 + 'ms">' +
        '<div class="ph">' + (s.image_id ? '<img loading="lazy" src="' + img(s.image_id) + '" alt="' + esc(s.name) + '">' : '<div class="noimg">ARDZ STORE</div>') + '</div>' +
        '<div class="cb"><span class="cat">' + esc(s.category) + '</span><h3>' + esc(s.name) + '</h3>' +
        '<div class="price">' + rp(s.price) + '</div><p class="desc" style="-webkit-line-clamp:5">' + esc(s.description) + '</p>' +
        '<div class="acts"><button class="btn btn-p" data-svc="' + s.id + '">PESAN SEKARANG</button></div></div></article>';
    }).join('') : emptyBox('Paket jasa belum tersedia.');
  }

  /* ---------- detail akun ---------- */
  function openDetail(id) {
    var a = S.accounts.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    var imgs = a.images || [], res = a.status === 'RESERVED';
    var m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = '<div class="sheet"><div class="sheet-h"><h3>' + esc(a.name) + '</h3><button class="x" data-close>✕</button></div>' +
      '<div class="gal-main">' + (imgs[0] ? '<img id="gm" src="' + img(imgs[0]) + '" alt="">' : '<div class="noimg" style="height:100%;display:grid;place-items:center;color:#a79bbd">Foto belum tersedia</div>') + '</div>' +
      (imgs.length > 1 ? '<div class="thumbs">' + imgs.map(function (x, i) { return '<img data-th="' + x + '" class="' + (i === 0 ? 'on' : '') + '" src="' + img(x) + '" alt="">'; }).join('') + '</div>' : '') +
      '<div class="price" style="margin-bottom:8px">' + rp(a.price) + '</div>' +
      '<p style="white-space:pre-line;color:#d8cdea;margin-bottom:16px">' + esc(a.description || 'Akun Free Fire, detail bisa dilihat melalui foto dan deskripsi.') + '</p>' +
      '<button class="btn btn-wa" style="width:100%" data-buy="' + a.id + '"' + (res ? ' disabled' : '') + '>' + (res ? 'SEDANG DIPESAN' : 'BELI VIA WHATSAPP') + '</button></div>';
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.hasAttribute('data-close')) m.remove();
      var th = e.target.getAttribute && e.target.getAttribute('data-th');
      if (th) {
        $('#gm', m).src = img(th);
        m.querySelectorAll('.thumbs img').forEach(function (i) { i.classList.toggle('on', i === e.target); });
      }
      if (e.target.hasAttribute('data-buy')) { buyAccount(a.id, e.target, m); }
    });
    document.body.appendChild(m);
  }

  /* ---------- pemesanan ---------- */
  function placeOrder(type, id, btn, modal) {
    var old = btn.textContent;
    btn.disabled = true; btn.textContent = 'Memproses...';
    api('/api/order', { method: 'POST', body: { type: type, id: id } }).then(function (d) {
      toast('Pesanan dicatat. Membuka WhatsApp...');
      if (modal) modal.remove();
      setTimeout(function () { window.location.href = d.wa; }, 500);
      if (type === 'account') loadAccounts();
    }).catch(function (e) {
      toast(e.message, true);
      btn.disabled = false; btn.textContent = old;
      if (e.status === 409) { if (modal) modal.remove(); loadAccounts(); }
    });
  }
  function buyAccount(id, btn, modal) { placeOrder('account', id, btn, modal); }

  /* ---------- loader ---------- */
  function loadAccounts() {
    return api('/api/public?r=accounts').then(function (d) {
      S.accounts = d.accounts; renderCount(); renderLatest(); renderCatalog();
    }).catch(function () { toast('Gagal memuat stok', true); });
  }
  function loadServices() {
    return api('/api/public?r=services').then(function (d) { S.services = d.services; renderServices(); })
      .catch(function () { toast('Gagal memuat jasa', true); });
  }

  /* ---------- router ---------- */
  function route() {
    var p = (location.hash || '#home').slice(1);
    if (['home', 'katalog', 'jasa', 'kontak'].indexOf(p) < 0) p = 'home';
    document.querySelectorAll('.page').forEach(function (s) { s.classList.toggle('hide', s.id !== 'page-' + p); });
    document.querySelectorAll('#links a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-p') === p); });
    $('#links').classList.remove('open');
    window.scrollTo(0, 0);
    if (p === 'katalog' || p === 'home') loadAccounts();
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    var b = t.closest('[data-buy]');
    if (b && !b.closest('.modal')) return buyAccount(Number(b.getAttribute('data-buy')), b, null);
    var d = t.closest('[data-detail]');
    if (d) return openDetail(Number(d.getAttribute('data-detail')));
    var sv = t.closest('[data-svc]');
    if (sv) return placeOrder('service', Number(sv.getAttribute('data-svc')), sv, null);
    var c = t.closest('[data-cat]');
    if (c) { S.cat = c.getAttribute('data-cat'); renderServices(); }
  });
  $('#burger').addEventListener('click', function () { $('#links').classList.toggle('open'); });
  $('#search').addEventListener('input', renderCatalog);
  $('#sort').addEventListener('change', renderCatalog);
  window.addEventListener('hashchange', route);

  $('#latest').innerHTML = $('#catalog').innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';

  api('/api/public?r=boot').then(function (d) {
    S.settings = d.settings; S.categories = d.categories; applySettings();
  }).catch(function () { toast('Gagal memuat data toko', true); });
  loadServices();
  route();
  setInterval(function () { if (!document.hidden && !$('#page-jasa').offsetParent) loadAccounts(); }, 30000);
})();
