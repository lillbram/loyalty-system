-- Loyalty Stempel — Supabase schema (multi-client)
-- Run whole file in Supabase Dashboard > SQL Editor. Safe to re-run.
-- NOTE: if an older single-client layout is found (customers.phone), customers and
-- stamp_log are dropped once and recreated (test data only).
--
-- Model:
--   admins   -> platform admin(s). Manage clients + cashier accounts (admin.html).
--   clients  -> one loyalty program each: name, logo, color, key type (phone/tiktok/...).
--   cashiers -> login accounts, each bound to ONE client.
--   customers/stamp_log -> scoped by client_id.
-- Security: RLS on, NO policies. All access via SECURITY DEFINER functions (RPC).

-- ---------- one-time migration from old layout ----------
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'customers' and column_name = 'phone') then
    drop table if exists stamp_log cascade;
    drop table if exists customers cascade;
  end if;
end $$;

drop function if exists require_cashier(text);
drop function if exists card_json(text);
drop function if exists get_card(text);
drop function if exists phone_log(text);
drop function if exists admin_save_client(uuid, text, text, text, text, text, text, boolean);
drop function if exists kasir_save_config(int, text, text);

-- ---------- tables ----------
create table if not exists clients (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}$'),
  name       text not null check (char_length(name) between 1 and 60),
  logo       text,
  color      text not null default '#5d8a3a' check (color ~ '^#[0-9a-fA-F]{6}$'),
  key_type   text not null default 'phone' check (key_type in ('phone','tiktok','instagram','email','custom')),
  key_label  text not null default 'Nomor HP',
  active     boolean not null default true,
  is_sandbox boolean not null default false,   -- true = dummy/test client
  created_at timestamptz not null default now()
);

-- one-time: older installs had no flag; everything that exists then is test data
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'clients' and column_name = 'is_sandbox') then
    alter table clients add column is_sandbox boolean not null default false;
    update clients set is_sandbox = true;
  end if;
end $$;

create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists cashiers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table cashiers add column if not exists client_id uuid references clients(id) on delete cascade;
alter table cashiers add column if not exists created_at timestamptz not null default now();

-- default client; adopt existing cashiers
insert into clients(slug, name, color, key_type, key_label, is_sandbox)
values ('matcha', 'Kartu Stempel Matcha', '#5d8a3a', 'phone', 'Nomor HP', true)
on conflict (slug) do nothing;
update cashiers set client_id = (select id from clients where slug = 'matcha') where client_id is null;
alter table cashiers alter column client_id set not null;

create table if not exists customers (
  client_id  uuid not null references clients(id) on delete cascade,
  key_id     text not null,
  stamps     int  not null default 0 check (stamps between 0 and 20),
  free       int  not null default 0 check (free >= 0),
  created_at timestamptz not null default now(),
  primary key (client_id, key_id)
);

-- Stamp card settings per client (editable by the cashier on the Profil page).
alter table clients add column if not exists stamp_total int  not null default 10;
alter table clients add column if not exists reward_name text not null default '1 gratis';
alter table clients add column if not exists stamp_logo  text;
-- Stamp icon: a built-in icon id, or 'logo' (the uploaded stamp_logo). Clients that already had a logo keep showing it.
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'clients' and column_name = 'stamp_icon') then
    alter table clients add column stamp_icon text not null default 'check';
    update clients set stamp_icon = 'logo' where stamp_logo is not null;
  end if;
end $$;
-- icon set changed once (cup, crown, flame, smile, bolt were dropped): map them to the default
alter table clients drop constraint if exists clients_stamp_icon_check;
update clients set stamp_icon = 'check' where stamp_icon in ('cup','crown','flame','smile','bolt');
alter table clients add constraint clients_stamp_icon_check
  check (stamp_icon in ('check','matcha','kopi','boba','es','kue','donat','cookie','star','heart','leaf','logo'));
alter table clients drop constraint if exists clients_stamp_total_check;
alter table clients add constraint clients_stamp_total_check check (stamp_total between 3 and 20);
alter table customers drop constraint if exists customers_stamps_check;
alter table customers add constraint customers_stamps_check check (stamps between 0 and 20);

create table if not exists stamp_log (
  id         bigint generated always as identity primary key,
  client_id  uuid not null,
  key_id     text not null,
  action     text not null check (action in ('stamp','redeem','undo')),
  stamp_no   int,
  cashier    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (client_id, key_id) references customers(client_id, key_id) on delete cascade
);
create index if not exists stamp_log_key_id on stamp_log (client_id, key_id, id desc);
create index if not exists stamp_log_created on stamp_log (client_id, created_at desc);

alter table clients   enable row level security;
alter table admins    enable row level security;
alter table cashiers  enable row level security;
alter table customers enable row level security;
alter table stamp_log enable row level security;

-- ---------- helpers ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create or replace function is_cashier() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from cashiers where user_id = auth.uid());
$$;

create or replace function my_cid() returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from cashiers where user_id = auth.uid();
$$;

create or replace function require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
end $$;

-- returns the cashier's client id; fails if not cashier or client disabled
create or replace function require_cashier() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare cid uuid;
begin
  select ca.client_id into cid
  from cashiers ca join clients c on c.id = ca.client_id
  where ca.user_id = auth.uid() and c.active;
  if cid is null then raise exception 'forbidden'; end if;
  return cid;
end $$;

-- validate + normalize a customer key per client key type
create or replace function norm_key(t text, raw text) returns text
language plpgsql immutable as $$
declare v text := btrim(coalesce(raw, ''));
begin
  if t = 'phone' then
    v := regexp_replace(v, '\D', '', 'g');
    if v like '62%' then v := '0' || substr(v, 3); end if;
    if v !~ '^08[0-9]{8,11}$' then raise exception 'invalid_key'; end if;
  elsif t in ('tiktok', 'instagram') then
    v := lower(regexp_replace(v, '^@+', ''));
    if v !~ '^[a-z0-9._]{2,30}$' then raise exception 'invalid_key'; end if;
  elsif t = 'email' then
    v := lower(v);
    if v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v) > 100 then raise exception 'invalid_key'; end if;
  else
    if char_length(v) not between 2 and 50 then raise exception 'invalid_key'; end if;
  end if;
  return v;
end $$;

create or replace function key_for(cid uuid, raw text) returns text
language plpgsql stable security definer set search_path = public as $$
declare t text;
begin
  select key_type into t from clients where id = cid;
  return norm_key(t, raw);
end $$;

create or replace function client_json(c clients) returns json
language sql immutable as $$
  select json_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'logo', c.logo,
                            'color', c.color, 'key_type', c.key_type, 'key_label', c.key_label,
                            'is_sandbox', c.is_sandbox,
                            'stamp_total', c.stamp_total, 'reward_name', c.reward_name, 'stamp_logo', c.stamp_logo,
                            'stamp_icon', c.stamp_icon);
$$;

create or replace function card_json(cid uuid, k text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'key', k,
    'stamps', coalesce((select stamps from customers where client_id = cid and key_id = k), 0),
    'free',   coalesce((select free   from customers where client_id = cid and key_id = k), 0),
    'since',  (select created_at from customers where client_id = cid and key_id = k),
    'total',  (select stamp_total from clients where id = cid),
    'log', coalesce((
      select json_agg(x) from (
        select action, stamp_no, created_at as at
        from stamp_log where client_id = cid and key_id = k order by id desc limit 3
      ) x), '[]'::json),
    'can_undo', coalesce(my_cid() = cid, false) and exists (
      select 1 from (select action, created_at from stamp_log
                     where client_id = cid and key_id = k order by id desc limit 1) l
      where l.action = 'stamp' and l.created_at > now() - interval '10 minutes')
  );
$$;

-- ---------- public (anon) ----------
create or replace function get_client(s text) returns json
language plpgsql stable security definer set search_path = public as $$
declare c clients;
begin
  select * into c from clients where slug = lower(coalesce(s, '')) and active;
  if not found then raise exception 'client_not_found'; end if;
  return client_json(c);
end $$;

create or replace function get_card(s text, p text) returns json
language plpgsql stable security definer set search_path = public as $$
declare c clients;
begin
  select * into c from clients where slug = lower(coalesce(s, '')) and active;
  if not found then raise exception 'client_not_found'; end if;
  return card_json(c.id, norm_key(c.key_type, p));
end $$;

-- ---------- any logged-in user ----------
create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select case when is_admin() then 'admin' when is_cashier() then 'cashier' end;
$$;

-- ---------- cashier ----------
create or replace function my_client() returns json
language plpgsql stable security definer set search_path = public as $$
declare c clients;
begin
  select * into c from clients where id = require_cashier();
  return client_json(c);
end $$;

create or replace function kasir_open(p text) returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := require_cashier(); k text;
begin
  k := key_for(cid, p);
  insert into customers(client_id, key_id) values (cid, k) on conflict do nothing;
  return card_json(cid, k);
end $$;

create or replace function add_stamp(p text) returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := require_cashier(); k text; c customers; l stamp_log; tot int;
begin
  k := key_for(cid, p);
  select stamp_total into tot from clients where id = cid;
  select * into c from customers where client_id = cid and key_id = k for update;
  if not found then raise exception 'not_found'; end if;
  if c.stamps >= tot then raise exception 'card_full'; end if;
  select * into l from stamp_log where client_id = cid and key_id = k order by id desc limit 1;
  if found and l.action = 'stamp' and l.created_at > now() - interval '20 seconds' then
    raise exception 'duplicate';
  end if;
  update customers set stamps = stamps + 1 where client_id = cid and key_id = k returning * into c;
  insert into stamp_log(client_id, key_id, action, stamp_no, cashier)
    values (cid, k, 'stamp', c.stamps, auth.uid());
  return card_json(cid, k);
end $$;

create or replace function undo_last(p text) returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := require_cashier(); k text; c customers; l stamp_log;
begin
  k := key_for(cid, p);
  select * into c from customers where client_id = cid and key_id = k for update;
  if not found then raise exception 'not_found'; end if;
  select * into l from stamp_log where client_id = cid and key_id = k order by id desc limit 1;
  if not found or l.action <> 'stamp' or l.created_at <= now() - interval '10 minutes' then
    raise exception 'cannot_undo';
  end if;
  update customers set stamps = stamps - 1 where client_id = cid and key_id = k returning * into c;
  insert into stamp_log(client_id, key_id, action, stamp_no, cashier)
    values (cid, k, 'undo', l.stamp_no, auth.uid());
  return card_json(cid, k);
end $$;

create or replace function redeem_free(p text) returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := require_cashier(); k text; c customers; tot int;
begin
  k := key_for(cid, p);
  select stamp_total into tot from clients where id = cid;
  select * into c from customers where client_id = cid and key_id = k for update;
  if not found then raise exception 'not_found'; end if;
  if c.stamps < tot then raise exception 'not_full'; end if;
  update customers set stamps = 0, free = free + 1 where client_id = cid and key_id = k;
  insert into stamp_log(client_id, key_id, action, cashier) values (cid, k, 'redeem', auth.uid());
  return card_json(cid, k);
end $$;

create or replace function today_log() returns json
language plpgsql stable security definer set search_path = public as $$
declare cid uuid := require_cashier();
begin
  return coalesce((
    select json_agg(x) from (
      select key_id as key, action, stamp_no, created_at as at
      from stamp_log
      where client_id = cid
        and created_at >= (date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')
      order by id desc limit 200
    ) x), '[]'::json);
end $$;

-- Cashier edits the stamp card of its own client: stamp count, reward name, stamp logo.
-- Lowering the count caps existing cards at the new count (they become full).
-- p_logo: null keeps the current logo, '' removes it, else a small data: image (resized by the page).
-- p_icon: null keeps the current icon; else a built-in icon id or 'logo' (needs an uploaded logo).
create or replace function kasir_save_config(p_total int, p_reward text, p_logo text default null, p_icon text default null) returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := require_cashier(); rw text := btrim(coalesce(p_reward, '')); c clients;
begin
  if p_total is null or p_total not between 3 and 20 then raise exception 'bad_total'; end if;
  if char_length(rw) not between 1 and 40 then raise exception 'bad_reward'; end if;
  if p_logo is not null and p_logo <> '' then
    if p_logo !~ '^data:image/(png|jpeg|webp|gif);base64,' then raise exception 'bad_logo'; end if;
    if char_length(p_logo) > 60000 then raise exception 'logo_too_big'; end if;
  end if;
  if p_icon is not null and p_icon not in ('check','matcha','kopi','boba','es','kue','donat','cookie','star','heart','leaf','logo') then
    raise exception 'bad_icon';
  end if;
  update clients set stamp_total = p_total, reward_name = rw,
         stamp_logo = case when p_logo is null then stamp_logo when p_logo = '' then null else p_logo end,
         stamp_icon = coalesce(p_icon, stamp_icon)
   where id = cid returning * into c;
  -- no uploaded logo left -> fall back to the default icon
  if c.stamp_icon = 'logo' and c.stamp_logo is null then
    update clients set stamp_icon = 'check' where id = cid returning * into c;
  end if;
  update customers set stamps = least(stamps, p_total) where client_id = cid and stamps > p_total;
  return client_json(c);
end $$;

-- p null = latest 50 of all customers; else full history of one customer
create or replace function key_log(p text default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare cid uuid := require_cashier(); k text := null;
begin
  if p is not null then k := key_for(cid, p); end if;
  return coalesce((
    select json_agg(x) from (
      select key_id as key, action, stamp_no, created_at as at
      from stamp_log
      where client_id = cid and (k is null or key_id = k)
      order by id desc
      limit case when k is null then 50 else 500 end
    ) x), '[]'::json);
end $$;

-- ---------- admin ----------
create or replace function admin_list_clients() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return coalesce((
    select json_agg(x order by x.created_at) from (
      select c.id, c.slug, c.name, c.logo, c.color, c.key_type, c.key_label, c.active, c.is_sandbox, c.created_at,
             (select count(*) from cashiers k where k.client_id = c.id)::int  as cashiers,
             (select count(*) from customers u where u.client_id = c.id)::int as customers
      from clients c
    ) x), '[]'::json);
end $$;

-- p_id null = create. Slug and sandbox flag are fixed after creation
-- (printed QR links depend on the slug; the flag decides which environment can open the client).
create or replace function admin_save_client(
  p_id uuid, p_slug text, p_name text, p_logo text, p_color text,
  p_key_type text, p_key_label text, p_active boolean, p_sandbox boolean default false
) returns json
language plpgsql security definer set search_path = public as $$
declare
  r clients;
  lg text := nullif(btrim(coalesce(p_logo, '')), '');
  lb text := nullif(btrim(coalesce(p_key_label, '')), '');
begin
  perform require_admin();
  if lg is not null and not (lg ~ '^https://' or lg ~ '^data:image/(png|jpeg|webp|gif);base64,') then
    raise exception 'bad_logo';
  end if;
  if lg is not null and char_length(lg) > 300000 then raise exception 'logo_too_big'; end if;
  lb := coalesce(lb, case p_key_type
    when 'phone' then 'Nomor HP' when 'tiktok' then 'Username TikTok'
    when 'instagram' then 'Username Instagram' when 'email' then 'Email' else 'ID' end);

  if p_id is null then
    insert into clients(slug, name, logo, color, key_type, key_label, active, is_sandbox)
    values (lower(btrim(p_slug)), btrim(p_name), lg, p_color, p_key_type, lb, coalesce(p_active, true), coalesce(p_sandbox, false))
    returning * into r;
  else
    if exists (select 1 from clients where id = p_id and key_type <> p_key_type)
       and exists (select 1 from customers where client_id = p_id) then
      raise exception 'key_type_locked';
    end if;
    update clients set name = btrim(p_name), logo = lg, color = p_color,
           key_type = p_key_type, key_label = lb, active = coalesce(p_active, true)
    where id = p_id returning * into r;
    if not found then raise exception 'not_found'; end if;
  end if;
  return row_to_json(r);
exception when unique_violation then
  raise exception 'slug_taken';
end $$;

create or replace function admin_list_cashiers(cid uuid) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return coalesce((
    select json_agg(x order by x.created_at) from (
      select ca.user_id, u.email, ca.created_at
      from cashiers ca join auth.users u on u.id = ca.user_id
      where ca.client_id = cid
    ) x), '[]'::json);
end $$;

-- Removes cashier access (the auth user remains but can no longer stamp).
create or replace function admin_remove_cashier(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  -- Delete the login itself (cashiers row goes with it by cascade), so the email can be reused.
  -- Only for cashier accounts; never touches an admin login.
  if exists (select 1 from cashiers where user_id = uid) and not exists (select 1 from admins where user_id = uid) then
    delete from auth.users where id = uid;
  else
    delete from cashiers where user_id = uid;
  end if;
end $$;

-- Creates a login (auth user, email auto-confirmed) and binds it to one client as cashier.
-- Writes straight into auth.users / auth.identities so no Edge Function deploy is needed.
-- If a future Supabase version changes those tables, use supabase/functions/create-cashier instead.
create or replace function admin_create_cashier(p_client uuid, p_email text, p_password text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := gen_random_uuid();
  em  text := lower(btrim(coalesce(p_email, '')));
begin
  perform require_admin();
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(em) > 120 then raise exception 'invalid_email'; end if;
  if p_password is null or char_length(p_password) < 8 or char_length(p_password) > 72 then
    raise exception 'weak_password';
  end if;
  if not exists (select 1 from clients where id = p_client) then raise exception 'not_found'; end if;
  if exists (select 1 from auth.users where lower(email) = em) then raise exception 'email_taken'; end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, 'email',
          jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), now(), now(), now());

  insert into cashiers(user_id, client_id) values (uid, p_client);
  return json_build_object('user_id', uid, 'email', em);
end $$;

-- ---------- permissions ----------
revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function get_client(text), get_card(text, text) to anon, authenticated;
grant execute on function my_role(), is_admin() to authenticated;  -- is_admin(): used by the storage policies below
grant execute on function my_client(), kasir_open(text), add_stamp(text), undo_last(text),
  redeem_free(text), today_log(), key_log(text), kasir_save_config(int, text, text, text) to authenticated;
grant execute on function admin_list_clients(),
  admin_save_client(uuid, text, text, text, text, text, text, boolean, boolean),
  admin_list_cashiers(uuid), admin_remove_cashier(uuid),
  admin_create_cashier(uuid, text, text) to authenticated;

-- ---------- logo storage ----------
-- Logos live in a public bucket (served with long cache headers) instead of inside the
-- database, so every page view does not re-download them from the database API.
-- Only admins can upload or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 262144, array['image/png', 'image/webp', 'image/jpeg', 'image/gif'])
on conflict (id) do update set public = true,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin insert logos" on storage.objects;
drop policy if exists "admin update logos" on storage.objects;
drop policy if exists "admin delete logos" on storage.objects;
create policy "admin insert logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.is_admin());
create policy "admin update logos" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.is_admin()) with check (bucket_id = 'logos' and public.is_admin());
create policy "admin delete logos" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.is_admin());

-- ---------- first admin (after creating the user in Auth > Users) ----------
-- insert into admins(user_id) select id from auth.users where email = 'admin@contoh.com';
-- Cashier accounts are created from admin-client.html (RPC admin_create_cashier).
