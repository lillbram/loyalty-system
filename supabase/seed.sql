-- Test data for the default client (slug 'matcha'). Run after schema.sql.
-- 081234567890 -> 5 stamps
-- 085700001111 -> 10 stamps (full, ready to redeem)

insert into customers(client_id, key_id, stamps, free)
select id, v.k, v.s, 0
from clients, (values ('081234567890', 5), ('085700001111', 10)) as v(k, s)
where slug = 'matcha'
on conflict (client_id, key_id) do update set stamps = excluded.stamps, free = excluded.free;

delete from stamp_log
where client_id = (select id from clients where slug = 'matcha')
  and key_id in ('081234567890', '085700001111');

insert into stamp_log(client_id, key_id, action, stamp_no, created_at)
select c.id, '081234567890', 'stamp', n, now() - interval '1 day' - (5 - n) * interval '1 hour'
from clients c, generate_series(1, 5) n where c.slug = 'matcha';

insert into stamp_log(client_id, key_id, action, stamp_no, created_at)
select c.id, '085700001111', 'stamp', n, now() - interval '1 day' - (10 - n) * interval '1 hour'
from clients c, generate_series(1, 10) n where c.slug = 'matcha';
