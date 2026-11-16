// Shared helpers for admin pages. Load after config.js.
(function () {
  document.documentElement.classList.add('js');

  window.$ = (id) => document.getElementById(id);
  window.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Bold-weight outline icons (Phosphor-style, 256 grid, one stroke width).
  const P = {
    back: '<line x1="216" y1="128" x2="40" y2="128"/><polyline points="112 56 40 128 112 200"/>',
    arrow: '<line x1="40" y1="128" x2="216" y2="128"/><polyline points="144 56 216 128 144 200"/>',
    plus: '<line x1="40" y1="128" x2="216" y2="128"/><line x1="128" y1="40" x2="128" y2="216"/>',
    copy: '<rect x="84" y="84" width="132" height="132" rx="8"/><path d="M172 84V40a8 8 0 0 0-8-8H40a8 8 0 0 0-8 8v124a8 8 0 0 0 8 8h44"/>',
    out: '<polyline points="174 86 216 128 174 170"/><line x1="104" y1="128" x2="216" y2="128"/><path d="M104 216H48a8 8 0 0 1-8-8V48a8 8 0 0 1 8-8h56"/>',
    x: '<line x1="200" y1="56" x2="56" y2="200"/><line x1="200" y1="200" x2="56" y2="56"/>',
  };
  window.icon = (n) => `<svg class="i" viewBox="0 0 256 256" aria-hidden="true">${P[n]}</svg>`;

  window.bye = () => SB.auth.signOut().finally(() => location.replace('admin-login.html'));

  window.toast = (t, ok) => {
    const m = $('msg');
    if (!m) return;
    m.textContent = t;
    m.className = 'msg ' + (ok ? 'ok' : 'err');
    m.hidden = !t;
    if (t) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.rpc = async (fn, args) => {
    const { data, error } = await SB.rpc(fn, args);
    if (error) {
      toast(sbError(error));
      if ((error.message || '').includes('forbidden')) bye();
      return { err: true };
    }
    return { data };
  };

  window.link = (slug) => new URL('index.html?c=' + encodeURIComponent(slug), location.href).href;
  window.loginLink = (slug) => new URL('login.html?c=' + encodeURIComponent(slug), location.href).href;
  window.copy = async (url, what) => {
    try { await navigator.clipboard.writeText(url); toast(what + ' disalin: ' + url, true); }
    catch (_) { toast(what + ': ' + url, true); }
  };

  // Fade-up on first view. IntersectionObserver only; CSS gates it behind reduced-motion.
  window.reveal = () => {
    const els = [...document.querySelectorAll('.reveal:not(.in)')];
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.05 });
    els.forEach((e) => io.observe(e));
  };

  // Resolves to the session when the user is an admin. Otherwise redirects or shows a notice and resolves null.
  window.adminGuard = async () => {
    if (!window.SB_READY) { location.replace('admin-login.html'); return null; }
    const { data: { session } } = await SB.auth.getSession();
    if (!session) { location.replace('admin-login.html'); return null; }
    const { data: role } = await SB.rpc('my_role');
    if (role === 'admin') return session;
    document.body.innerHTML = `<main class="page narrow"><section class="panel stack">
      <span class="eyebrow" style="margin:0">Platform admin</span>
      <h2>Bukan akun admin</h2>
      <p class="note">Masuk sebagai <b>${esc(session.user.email || '')}</b> (${role === 'cashier' ? 'akun kasir' : 'tanpa peran'}). Halaman ini hanya untuk admin.</p>
      <button class="btn" id="dOut">Keluar, lalu masuk sebagai admin</button>
      <p class="note">Kalau ini memang akun admin, tambahkan ke tabel <code>admins</code> lewat SQL Editor, lalu muat ulang.</p>
    </section></main>`;
    $('dOut').onclick = bye;
    return null;
  };
})();
