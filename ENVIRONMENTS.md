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

## Deploy flow

1. Change code and test locally: `cd public && python3 -m http.server 8765` (shows as sandbox).
2. Push to `sandbox`: `git push origin main:sandbox`. Check the sandbox URL.
3. Push to `main`: `git push origin main`. Production deploys.
4. Every UI change goes to both branches, so both environments stay the same.

## Supabase

- Schema changes: run `supabase/schema.sql` in the Supabase SQL Editor. It is safe to run again. Test on sandbox clients first. Do not change the schema carelessly once real clients exist.
- `supabase/seed.sql` is for the dummy client `matcha` only. Never run it for a real client.
- Usage limits and keepalive: see the Supabase section of `CLAUDE.md`.
