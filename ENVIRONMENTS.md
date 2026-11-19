# Environments and access

One codebase, one Supabase project, two environments. The environment is decided by the hostname (`PROD_HOSTS` in `public/config.js`) and by the `clients.is_sandbox` flag. Each environment only shows its own clients.

| | Production | Sandbox |
|---|---|---|
| Purpose | Real clients and real customers | Dummy clients (for example `matcha`), testing |
| Git branch | `main` | `sandbox` |
| Cloudflare project | `loyalty-system` (production branch `main`) | `sandbox-loyalty-system` (production branch `sandbox`) |
| Base URL | https://loyalty-system.bosh-project.workers.dev | https://sandbox-loyalty-system.bosh-project.workers.dev |
| Page tag | none | SANDBOX tag shown |
| Clients shown | `is_sandbox = false` | `is_sandbox = true` |

If the production address changes (custom domain or workers.dev subdomain), update `PROD_HOSTS` in `public/config.js` before printing any QR poster.

## Links

Replace `<base>` with the base URL of the environment and `<slug>` with the client code.

| Who | Link |
|---|---|
| Admin login | `<base>/admin-login.html` |
| Admin client list | `<base>/admin.html` |
| Create or edit a client | `<base>/admin-client.html` |
| Customer card | `<base>/index.html?c=<slug>` |
| Cashier login | `<base>/login.html?c=<slug>` |
| Cashier home, log, profile | `<base>/kasir.html`, `<base>/log.html`, `<base>/profile.html` (after login) |

The admin list has copy buttons for the customer link and the cashier login link of each client.

Example: `https://loyalty-system.bosh-project.workers.dev/login.html?c=<slug>`

## Access

| Role | Where it comes from | What it can do |
|---|---|---|
| Admin | Row in table `admins` (Supabase Auth user). Same account works in both environments. | Create and edit clients, create and remove cashier accounts. Sees only the clients of the environment it is on. |
| Cashier | Created by an admin in `admin-client.html` (button to create account). Bound to exactly one client. | Stamp, undo, redeem, view log, print QR poster, for its own client only. |
| Customer | No account. Enters their ID (phone, TikTok, Instagram, email or text, set per client). | View their own stamp card. |

Rules:

- Admin and cashier sessions are separate (`loyalty-admin-auth` and `loyalty-cashier-auth`). Logging in as admin does not log out a cashier in the same browser.
- A cashier can only log in through the login link of its own client.
- A client opened on the wrong environment shows an "Environment salah" message. This is a UI guard, not a security boundary: the database and admin accounts are shared.
- Do not store passwords or keys in this file. The Supabase publishable key in `public/config.js` is public by design. Keep the Supabase service-role key and database password out of the repository.

## Test accounts (sandbox)

Created for QA on 2026-11-18. Throwaway passwords, kept here on request. This file is in the private repo root and is not served by the website (only `public/` is). Change or delete both accounts before real clients go live.

| Account | Password | Role | Client | Use at |
|---|---|---|---|---|
| `qa-admin@example.test` | `CHANGE-ME-admin-1` | Admin | all (sandbox clients only on the sandbox host) | https://sandbox-loyalty-system.bosh-project.workers.dev/admin-login.html |
| `qa-kasir@example.test` | `CHANGE-ME-kasir-1` | Cashier | `matcha` (dummy, sandbox) | https://sandbox-loyalty-system.bosh-project.workers.dev/login.html?c=matcha |

Notes:

- Accounts live in one shared Supabase project. `qa-admin` is a full admin on production too, and logs in at the production admin page. Delete it (or change its password) before real clients go live.
### Customer page test cards (sandbox, client `matcha`)

Customer link: https://sandbox-loyalty-system.bosh-project.workers.dev/?c=matcha (also works as `index.html?c=matcha`). Type the phone number in the field and press Cek.

| Card | Phone number | Stamps | What to check |
|---|---|---|---|
| Empty | `081200000001` | 0/10 | "Belum ada stempel" message, 10 empty circles, QR shown |
| Half full | `081200000005` | 5/10 | 5 filled, "5 pembelian lagi" message |
| Full | `081200000010` | 10/10 | all filled, GRATIS slot, "Selamat! Kamu dapat 1 gratis" message |

Also try: `+62 812-0000-0005` (normalizes to `081200000005`), `abc` (invalid ID error), and `081299999999` (unknown ID shows an empty card).

Do not redeem `081200000010` unless you want to reset it. To refill: cashier opens the number on Beranda and stamps it 10 times (20 seconds between stamps).

- Dummy data left by tests: client `qa-test`, accounts `qa-tmp*@example.test`, customers with IDs starting `0812999` on `matcha`. Remove with the clean-up SQL below.
- Test customer IDs for manual checks: any `08xxxxxxxxxx` number. The cashier must open an ID (type it on the Beranda page) before it can be stamped.

Clean-up SQL (Supabase SQL Editor):

```sql
delete from auth.users where email like 'qa-tmp%@example.test';
delete from clients where slug = 'qa-test';
delete from customers where key_id like '0812999%' or key_id like '0812777%' or key_id = '081200001111';
-- when QA is finished:
-- delete from auth.users where email in ('qa-admin@example.test', 'qa-kasir@example.test');
```

## Deploy flow

1. Change code and test locally: `cd public && python3 -m http.server 8765` (shows as sandbox).
2. Push to `sandbox`: `git push origin main:sandbox`. Check the sandbox URL.
3. Push to `main`: `git push origin main`. Production deploys.
4. Every UI change goes to both branches, so both environments stay the same.

## Supabase

- Schema changes: run `supabase/schema.sql` in the Supabase SQL Editor. It is safe to run again. Test on sandbox clients first. Do not change the schema carelessly once real clients exist.
- `supabase/seed.sql` is for the dummy client `matcha` only. Never run it for a real client.
- Usage limits and keepalive: see the Supabase section of `CLAUDE.md`.
