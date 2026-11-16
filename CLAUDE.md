# Loyalty Stempel (multi-klien)

Platform loyalty stempel: beli 10x, gratis 1. Satu platform melayani banyak klien (kedai), tiap klien punya nama, logo, warna, jenis ID pelanggan, dan akun kasir sendiri. Klien awal: `matcha` (Kartu Stempel Matcha).

## Struktur & environment
- Semua file situs ada di `public/` (itu yang di-deploy ke Cloudflare Pages, output directory = `public`). `supabase/` dan `CLAUDE.md` tidak ikut tampil publik.
- **Satu project Supabase, dua environment.** Pemisahnya flag `clients.is_sandbox`. Klien dummy (`is_sandbox = true`) hanya bisa dibuka dari sandbox (localhost, preview Cloudflare, `sandbox.*`, label SANDBOX tampil); klien asli hanya dari hostname di `PROD_HOSTS` di `public/config.js`. Admin hanya melihat klien environment-nya dan klien baru otomatis ikut environment tempat dibuat. Ini penjaga di tampilan, bukan batas keamanan: DB dan akun admin tetap satu. Jangan ubah skema (`schema.sql`) langsung saat ada klien asli tanpa dicoba dulu.
- `supabase/schema.sql` aman dijalankan ulang. `supabase/seed.sql` hanya untuk klien dummy `matcha`.
- Jalankan lokal: `cd public && python3 -m http.server 8765`.

## File (di `public/`)
- `index.html?c=<slug>` — halaman pelanggan per klien: masukkan ID (HP / TikTok / Instagram / email / teks), lihat kartu 10 stempel + QR pribadi (`LOYALTY:<slug>:<id>`). Tema (nama, logo, warna) dari klien.
- `login.html?c=<slug>` — login kasir, berbrand klien, hanya menerima kasir klien itu (tiap klien punya URL sendiri). Tanpa `?c=` → pesan error.
- `admin-login.html` — login admin (tema putih netral). URL dan sesi terpisah dari login kasir: `config.js` memakai `storageKey` beda (`loyalty-admin-auth` vs `loyalty-cashier-auth`), jadi login admin tidak mengeluarkan kasir di browser yang sama.
- `admin.html` — admin, beranda = daftar klien (statistik + tabel). Tombol **Kelola** dan **Klien baru** membuka halaman terpisah `admin-client.html[?id=<uuid>]`: form klien (nama, kode link, warna, logo, jenis ID, aktif), pratinjau, dan akun kasir (buat/cabut). `admin.css` + `admin.js` dipakai bersama oleh 3 halaman admin. Gaya: minimalis warm-monochrome (putih/ink, serif Newsreader + Geist), terpisah dari warna klien.
- `kasir.html` (Beranda) — kasir: scan QR (jsQR) atau ketik ID, beri stempel, batalkan, tukar gratis di 10/10, log hari ini.
- `log.html` — kasir: riwayat per ID (`key_log`), atau 50 terbaru semua pelanggan.
- `profile.html` — kasir: akun, logout, cetak QR poster yang mengarah ke `index.html?c=<slug>`.
- `nav.js` — menu bawah (Beranda/Log/Profil), `guard()` sesi, `loadClient()` (`my_client`), `bye()`. Dipakai 3 halaman kasir.
- `config.js` — kunci Supabase, `KEYS` (jenis ID), `fmtKey`, `applyBrand` (terapkan warna/logo), `sbError`.
- `supabase/schema.sql` — tabel + fungsi RPC. Aman dijalankan ulang. `supabase/seed.sql` — 2 pelanggan tes di klien `matcha`.
- Akun kasir dibuat dari `admin-client.html` lewat RPC `admin_create_cashier` (SQL, menulis ke `auth.users` + `auth.identities`, tanpa deploy). `supabase/functions/create-cashier/index.ts` = alternatif Edge Function (opsional, pakai API admin resmi) bila skema `auth` berubah.

## Status sekarang
Backend Supabase. Tabel dikunci RLS tanpa policy; semua akses lewat fungsi `SECURITY DEFINER`.
- Anon (pelanggan): `get_client`, `get_card`.
- Kasir (tabel `cashiers`, terikat 1 klien): `my_client`, `kasir_open`, `add_stamp`, `undo_last`, `redeem_free`, `today_log`, `key_log`. Klien ditentukan dari akun kasir, bukan dari input.
- Admin (tabel `admins`): `admin_list_clients`, `admin_save_client`, `admin_list_cashiers`, `admin_remove_cashier`; buat kasir lewat Edge Function.
- Anti-dobel stempel 20 detik, batal stempel maks 10 menit.

## Aturan bisnis
- ID pelanggan dinormalisasi di server (`norm_key`) sesuai jenis ID klien:
  - phone: hapus non-digit, `62xxx` → `08xxx`, valid `^08\d{8,11}$`.
  - tiktok / instagram: buang `@`, huruf kecil, `^[a-z0-9._]{2,30}$`.
  - email: huruf kecil, format email. custom: teks 2–50 karakter.
- Jenis ID klien terkunci setelah klien punya pelanggan. Kode link (slug) terkunci setelah dibuat (dipakai di QR cetak).
- 1 pembelian = 1 stempel, maks 10. Di 10/10 tombol stempel diganti tombol tukar.
- Tukar gratis: stempel → 0, `free` +1, dicatat di log.
- ID baru otomatis dibuat dengan 0 stempel (oleh kasir).
- Klien nonaktif: pelanggan dan kasir tidak bisa akses.

## Langkah berikutnya
QR bertoken (QR sekarang `LOYALTY:<slug>:<id>`, bisa dipalsukan), scan kamera live di kasir, kode redeem sekali pakai, login pelanggan (OTP), PWA/offline, deploy ke domain publik.

## Gaya UI
Bahasa Indonesia. Semua halaman (admin, kasir, pelanggan, login) satu gaya minimalis: kanvas putih, teks charcoal, serif Newsreader untuk judul, Geist untuk teks, Geist Mono untuk angka/ID, border 1px `#EAEAEA`, komponen datar tanpa bayangan, mobile-first, hanya mode terang. Gaya dasar di `admin.css`, tambahan halaman klien di `app.css`.
Satu-satunya warna dari klien adalah aksen (`--accent`, dipilih di admin > Warna, diterapkan `applyBrand()` di `config.js`): tombol utama, stempel terisi, garis tab aktif, fokus input. Tanpa klien/di halaman admin, aksen default hitam `#111`.

## Batas Supabase (free) dan pencegahannya
- Logo disimpan di Storage bucket publik `logos` (cache 1 tahun, maks 256 KB), bukan di kolom database, supaya tiap tampilan halaman tidak mengunduh ulang logo lewat API.
- `.github/workflows/keepalive.yml` memanggil database tiap 3 hari agar project tidak di-pause setelah 7 hari tanpa aktivitas (aktif setelah repo di-push ke GitHub).
- Pantau di Dashboard > Settings > Usage: database size (500 MB), egress (5 GB), Storage (1 GB). Satu baris `stamp_log` sekitar 100 byte, jadi ribuan pelanggan tidak mendekati batas.
- Endpoint publik `get_card` bisa ditebak-tebak. Bila ada penyalahgunaan: pasang Cloudflare Turnstile/rate limit, atau tambah OTP.
- Upgrade ke Pro ($25/bln) bila data asli sudah dipakai klien: tidak ada pause, ada backup harian, dan batas lebih besar.
