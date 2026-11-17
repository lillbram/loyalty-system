// Satu project Supabase untuk dua environment. Pemisahnya adalah flag `is_sandbox` di tiap klien:
//   production = klien asli (is_sandbox = false), hanya bisa dibuka dari PROD_HOSTS.
//   sandbox    = klien dummy (is_sandbox = true), dibuka dari localhost / preview Cloudflare / sandbox.*
// Publishable key aman ditaruh di browser: akses data dibatasi RLS + fungsi di supabase/schema.sql.
// (Jangan pernah taruh secret / service_role key di sini.)
const SUPABASE_URL = "https://jptdttjievlgbvwijmma.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_NUBkLODH6Jig4cGhJNhwiw_F7wTFzs6";

// Hanya hostname di daftar ini yang dianggap production. Hostname lain otomatis sandbox.
const PROD_HOSTS = ["loyalty-system.abrahambobellson.workers.dev"];
window.APP_ENV = PROD_HOSTS.includes(location.hostname) ? "production" : "sandbox";

// Cegah salah environment: klien asli tidak dibuka dari sandbox, klien dummy tidak dibuka dari production.
// (Penjaga di tampilan, bukan batas keamanan database.)
window.envMismatch = (c) => {
  const prod = window.APP_ENV === "production";
  if (c.is_sandbox && prod) return "Klien ini hanya untuk sandbox.";
  if (!c.is_sandbox && !prod) return "Klien produksi tidak bisa dibuka dari sandbox. Pakai alamat produksi.";
  return "";
};

window.SB_READY = !SUPABASE_URL.includes("YOUR-");

// Label SANDBOX supaya tidak salah mengira ini data asli.
if (window.APP_ENV !== "production") {
  const tag = document.createElement("div");
  tag.textContent = "SANDBOX · data dummy";
  tag.setAttribute("style",
    "position:fixed;top:8px;right:8px;z-index:9999;pointer-events:none;padding:3px 9px;border-radius:9999px;" +
    "background:#FBF3DB;color:#956400;font:500 11px/1.5 ui-monospace,monospace;letter-spacing:.05em;text-transform:uppercase");
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(tag));
}
// Admin and cashier sessions are stored under different keys, so logging in as one
// never signs out the other in the same browser.
window.IS_ADMIN_AREA = /\/admin(-[a-z]+)?\.html$/.test(location.pathname);
window.SB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: window.IS_ADMIN_AREA ? "loyalty-admin-auth" : "loyalty-cashier-auth" },
});

// Jenis ID pelanggan yang bisa dipilih per klien.
window.KEYS = {
  phone: { label: "Nomor HP", ph: "0812 3456 7890", type: "tel", mode: "numeric",
    fmt: (k) => k.replace(/(\d{4})(\d{4})(\d+)/, "$1 $2 $3") },
  tiktok: { label: "Username TikTok", ph: "@username", type: "text", mode: "text", fmt: (k) => "@" + k },
  instagram: { label: "Username Instagram", ph: "@username", type: "text", mode: "text", fmt: (k) => "@" + k },
  email: { label: "Email", ph: "nama@email.com", type: "email", mode: "email", fmt: (k) => k },
  custom: { label: "ID", ph: "", type: "text", mode: "text", fmt: (k) => k },
};
window.fmtKey = (t, k) => (KEYS[t] || KEYS.custom).fmt(String(k));

// Terapkan warna, logo, dan nama klien ke halaman.
// Elemen opsional: #logo (<img>), .brand-name.
window.applyBrand = (c, titleSuffix) => {
  const s = document.documentElement.style;
  // Only the accent comes from the client (admin page > Warna). Everything else is the shared white style.
  s.setProperty("--accent", c.color);
  const h = c.color.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  s.setProperty("--on", 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#111" : "#fff");
  document.title = c.name + (titleSuffix ? " · " + titleSuffix : "");
  const img = document.getElementById("logo");
  if (img) {
    if (c.logo) { img.src = c.logo; img.alt = c.name; img.hidden = false; } else img.hidden = true;
  }
  document.querySelectorAll(".brand-name").forEach((e) => (e.textContent = c.name));
};

// Terjemahkan kode error dari fungsi SQL ke teks Indonesia.
window.sbError = (e) => {
  const m = (e && e.message) || "";
  const map = {
    invalid_key: "Format ID tidak valid.",
    forbidden: "Akun ini tidak punya akses.",
    client_not_found: "Program loyalty tidak ditemukan atau nonaktif.",
    card_full: "Kartu sudah penuh. Tukar gratis dulu.",
    duplicate: "Stempel baru saja diberikan. Tunggu 20 detik untuk mencegah dobel.",
    cannot_undo: "Tidak ada stempel yang bisa dibatalkan (maks 10 menit).",
    not_full: "Kartu belum 10/10.",
    not_found: "Data tidak ditemukan.",
    email_taken: "Email sudah terdaftar.",
    weak_password: "Password harus 8–72 karakter.",
    invalid_email: "Email tidak valid.",
    slug_taken: "Kode link sudah dipakai klien lain.",
    key_type_locked: "Jenis ID tidak bisa diubah karena klien sudah punya pelanggan.",
    bad_logo: "Logo harus berupa gambar atau link https.",
    logo_too_big: "Logo terlalu besar.",
  };
  for (const k in map) if (m.includes(k)) return map[k];
  return "Gagal terhubung ke server. Coba lagi.";
};
