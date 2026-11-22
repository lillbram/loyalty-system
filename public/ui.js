// Shared UI pieces for the customer and cashier pages (index, kasir, log, profile).
// Plain JS that renders HTML strings from data. Needs config.js first. Styles are in app.css.
(function () {
  const P = {
    check: '<polyline points="5 12.5 10 17.5 19 7"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/><path d="M12 8c-1.5-3.5-5-4-5-1.8C7 8 9 8 12 8zm0 0c1.5-3.5 5-4 5-1.8C17 8 15 8 12 8z"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M4 12h16"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    torch: '<path d="M9 3h6l-1 6H10zM10 9v3l-2 3v6h8v-6l-2-3V9"/>',
    kbd: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    print: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2"/><rect x="7" y="14" width="10" height="7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    matcha: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9 21h6"/><path d="M12 8c2.5 0 3.5-1.4 3.5-3.5C13 4.5 12 6 12 8z"/>',
    kopi: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3v2M12 3v2"/>',
    boba: '<path d="M6 8h12l-1.2 12a1 1 0 0 1-1 .9H8.2a1 1 0 0 1-1-.9z"/><path d="M12 8l2-5"/><path d="M9.5 17h.01M12 18h.01M14.5 17h.01M11 14.5h.01M13.5 14.5h.01"/>',
    es: '<path d="M7 7h10l-1 13a1 1 0 0 1-1 .9H9a1 1 0 0 1-1-.9z"/><path d="M12 7V3h3"/><path d="M9.5 12h5"/>',
    kue: '<path d="M4 10l16-4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13.5h16"/><path d="M12 8v1.5"/>',
    donat: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.8"/><path d="M7.5 8.5l1 1M15 7.5l.8 1.2M16.5 14l1 .8M8 15.5l1-.6"/>',
    cookie: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9.5h.01M14.5 8.5h.01M15 14h.01M9.5 15h.01M12 12h.01"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    leaf: '<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z"/><path d="M5 19l8-8"/>',
  };
  window.ic = (n, cls) =>
    `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

  // Built-in stamp icons the cashier can choose from (Profil > Ikon stempel). 'logo' = uploaded image.
  window.STAMP_ICONS = [['matcha', 'Matcha'], ['kopi', 'Kopi'], ['boba', 'Boba'], ['es', 'Es'], ['kue', 'Kue'],
    ['donat', 'Donat'], ['cookie', 'Cookie'], ['star', 'Bintang'], ['heart', 'Hati'], ['leaf', 'Daun']];
  // What a filled stamp shows for this client.
  window.stampMark = (c) =>
    c.stamp_icon === 'logo' && c.stamp_logo
      ? `<img src="${escH(c.stamp_logo)}" alt="">`
      : ic(P[c.stamp_icon] && c.stamp_icon !== 'logo' ? c.stamp_icon : 'check');

  window.escH = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 22.34
  window.fmtTime = (a) =>
    new Date(a).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');

  const dayDiff = (a) => {
    const sd = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    return Math.round((sd(new Date()) - sd(new Date(a))) / 864e5);
  };
  // "kemarin, 15.20" / "12 Nov, 10.05"; cap = capitalize the first letter.
  window.relDay = (a, cap) => {
    const d = dayDiff(a);
    let t = d <= 0 ? 'hari ini' : d === 1 ? 'kemarin' : new Date(a).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    if (cap) t = t.charAt(0).toUpperCase() + t.slice(1);
    return t + ', ' + fmtTime(a);
  };
  // Time for today, "17 Nov 11.30" for older rows.
  window.logTime = (a) =>
    dayDiff(a) <= 0 ? fmtTime(a) : new Date(a).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + fmtTime(a);
  window.sinceMonth = (a) => new Date(a).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });

  // Brand tile: client logo, or a letter on the accent color.
  window.brandTile = (c) =>
    c.logo
      ? `<img class="lg" src="${escH(c.logo)}" alt="">`
      : `<span class="lg lg-letter" aria-hidden="true">${escH((c.name || '?').trim().charAt(0).toUpperCase())}</span>`;

  // Top row of every page: brand on the left, a small label on the right.
  window.topBar = (c, right) =>
    `<header class="top"><div class="bk">${brandTile(c)}<span>${escH(c.name)}</span></div>${
      right ? `<span class="rt">${escH(right)}</span>` : ''
    }</header>`;

  window.pageTitle = (title, sub) =>
    `<div class="ttl"><h1>${escH(title)}</h1>${sub ? `<p>${escH(sub)}</p>` : ''}</div>`;

  const label = (l) =>
    l.action === 'stamp' ? 'Stempel ke-' + l.stamp_no : l.action === 'undo' ? 'Stempel ke-' + l.stamp_no + ' dibatalkan' : 'Tukar gratis';

  // Stamp card. u = card JSON, c = client JSON, o = { full: text for the right label when full, pop: slot to animate }.
  // The last slot is always the reward slot.
  window.stampCard = (u, c, o) => {
    o = o || {};
    const t = c.stamp_total || u.total || 10, n = Math.min(u.stamps, t), full = n >= t;
    let g = '';
    for (let i = 1; i <= t; i++) {
      const pop = o.pop === i ? ' pop' : '';
      if (i === t) g += `<div class="s gift${full ? ' on' : ''}${pop}" aria-label="Hadiah${full ? ' siap' : ''}">${ic('gift')}</div>`;
      else if (i <= n)
        g += `<div class="s on${pop}" aria-label="Stempel ${i} terisi">${stampMark(c)}</div>`;
      else g += `<div class="s" aria-label="Stempel ${i}">${i}</div>`;
    }
    const last = (u.log || []).find((l) => l.action === 'stamp');
    const foot = n === 0 ? 'Belum ada stempel.'
      : !last ? ''
      : full ? `Stempel ke-${t} didapat ${relDay(last.at)}`
      : `Stempel terakhir: ${relDay(last.at)}`;
    return `<section class="stamp-card${full ? ' is-full' : ''}">
      <div class="count"><b>${n}/${t}</b><span>${full ? escH(o.full || 'Kartu penuh') : `${t - n} lagi → gratis`}</span></div>
      <div class="sgrid" style="--cols:5">${g}</div>
      ${foot ? `<p class="foot">${escH(foot)}</p>` : ''}
    </section>`;
  };

  // Recent history rows from card JSON ({action, stamp_no, at}).
  window.historyList = (title, log) =>
    log && log.length
      ? `<section class="hist"><h2>${escH(title)}</h2>${log
          .map(
            (l) =>
              `<div class="hr"><span class="${l.action === 'redeem' ? 'gifted' : ''}">${
                l.action === 'redeem' ? ic('gift') : '<i class="dot"></i>'
              }${escH(label(l))}</span><span>${escH(relDay(l.at, true))}</span></div>`
          )
          .join('')}</section>`
      : '';

  // Stamp logo picker: crop to a square, 96px, WebP, kept under the server limit (60000 chars).
  window.fileToStampLogo = (file) =>
    new Promise((ok, no) => {
      const img = new Image();
      img.onload = () => {
        const iw = img.naturalWidth || 96, ih = img.naturalHeight || 96, s = Math.min(iw, ih), cv = document.createElement('canvas');
        cv.width = cv.height = 96;
        cv.getContext('2d').drawImage(img, (iw - s) / 2, (ih - s) / 2, s, s, 0, 0, 96, 96);
        URL.revokeObjectURL(img.src);
        for (const q of [0.85, 0.7, 0.5, 0.3]) {
          const d = cv.toDataURL('image/webp', q);
          if (d.startsWith('data:image/webp') && d.length <= 60000) return ok(d);
        }
        const d = cv.toDataURL('image/png');
        d.length <= 60000 ? ok(d) : no(new Error('logo_too_big'));
      };
      img.onerror = () => no(new Error('bad_logo'));
      img.src = URL.createObjectURL(file);
    });
})();
