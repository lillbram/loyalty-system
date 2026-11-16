// Edge Function: create-cashier
// Admin-only. Creates an auth user (auto-confirmed) and binds it to one client as cashier.
// Needs the service role key, which Supabase injects automatically as SUPABASE_SERVICE_ROLE_KEY.
// The key never reaches the browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey') ?? '';

    // 1. Caller must be a logged-in admin (checked with the caller's own JWT).
    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: role, error: roleErr } = await asUser.rpc('my_role');
    if (roleErr || role !== 'admin') return json({ error: 'forbidden' }, 403);

    // 2. Validate input.
    const { client_id, email, password } = await req.json();
    if (typeof client_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(client_id)) return json({ error: 'bad_request' }, 400);
    if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) return json({ error: 'invalid_email' }, 400);
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) return json({ error: 'weak_password' }, 400);

    // 3. Create the user and bind to the client (service role).
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: cl } = await admin.from('clients').select('id').eq('id', client_id).maybeSingle();
    if (!cl) return json({ error: 'client_not_found' }, 404);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      const taken = /already|registered|exists/i.test(createErr?.message ?? '');
      return json({ error: taken ? 'email_taken' : 'create_failed' }, 400);
    }

    const { error: insErr } = await admin.from('cashiers').insert({ user_id: created.user.id, client_id });
    if (insErr) {
      await admin.auth.admin.deleteUser(created.user.id); // roll back
      return json({ error: 'assign_failed' }, 500);
    }
    return json({ ok: true, user_id: created.user.id, email: created.user.email });
  } catch (_e) {
    return json({ error: 'bad_request' }, 400);
  }
});
