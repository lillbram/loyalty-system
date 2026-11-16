// Shared by cashier pages (kasir.html, log.html, profile.html): bottom menu bar + auth guard.
// Needs config.js (SB, SB_READY) loaded first.
(function () {
  const icons = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    log: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  };
  const pages = [
    ['kasir.html', 'Beranda', 'home'],
    ['log.html', 'Log', 'log'],
    ['profile.html', 'Profil', 'user'],
  ];
  const here = location.pathname.split('/').pop() || 'kasir.html';

  const css = `
  body{padding-bottom:calc(88px + env(safe-area-inset-bottom,0px))}
  .tabbar{position:fixed;left:0;right:0;bottom:0;z-index:10;background:#fff;border-top:1px solid var(--line);
    display:flex;justify-content:center;padding-bottom:env(safe-area-inset-bottom,0px)}
  .tabbar nav{display:flex;width:100%;max-width:460px}
  .tabbar a{position:relative;flex:1;display:grid;justify-items:center;gap:2px;padding:12px 0 10px;color:var(--muted);text-decoration:none;font-size:12px;font-weight:500}
  .tabbar a:hover{color:var(--fg)}
  .tabbar a[aria-current=page]{color:var(--fg)}
  .tabbar a[aria-current=page]::before{content:"";position:absolute;top:-1px;left:25%;right:25%;height:2px;background:var(--accent,#111)}
  .tabbar svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  @media print{.tabbar{display:none}}`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  const bar = document.createElement('div');
  bar.className = 'tabbar';
  bar.innerHTML = '<nav aria-label="Menu">' + pages.map(([href, name, ic]) =>
    `<a href="${href}"${href === here ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${icons[ic]}</svg>${name}</a>`
  ).join('') + '</nav>';
  document.body.appendChild(bar);

  // Each client has its own cashier login URL: login.html?c=<slug>.
  const loginUrl = () => {
    let s = '';
    try { s = (window.CLIENT && window.CLIENT.slug) || localStorage.getItem('login-slug') || ''; } catch (e) {}
    return 'login.html' + (s ? '?c=' + encodeURIComponent(s) : '');
  };
  window.bye = () => SB.auth.signOut().finally(() => location.replace(loginUrl()));

  // Loads this cashier's client (name, logo, color, key type) and applies the brand.
  // Not a cashier (or client disabled) -> sign out.
  window.loadClient = async () => {
    const { data, error } = await SB.rpc('my_client');
    if (error) { window.bye(); return null; }
    const mm = window.envMismatch && window.envMismatch(data);
    if (mm) {
      document.body.innerHTML = '<main class="wrap"><section class="card"><h3>Environment salah</h3><p class="err">' + mm + '</p></section></main>';
      return null;
    }
    window.CLIENT = data;
    try { localStorage.setItem('login-slug', data.slug); } catch (e) {}
    return data;
  };

  // Returns the session, or redirects to login.html and returns null.
  window.guard = async () => {
    if (!window.SB_READY) { location.replace(loginUrl()); return null; }
    const { data: { session } } = await SB.auth.getSession();
    if (!session) { location.replace(loginUrl()); return null; }
    return session;
  };
})();
