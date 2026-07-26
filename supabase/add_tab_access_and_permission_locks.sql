-- ============================================================
-- Batch: per-user tab access + role/lock restrictions
-- Run this once in Supabase SQL Editor (after the earlier migrations).
-- ============================================================

-- ---------- Per-user tab access ----------
alter table profiles
  add column if not exists tab_access text[] not null default array['requests','confirmations','returned_by_courier']::text[];

-- Give existing Admins every tab (they previously saw all of them anyway
-- because the old nav hard-coded "admin sees Users").
update profiles
  set tab_access = array['requests','confirmations','returned_by_courier','users']
  where role = 'admin';

-- ---------- Requests: only Order Taker / Admin can edit or update status ----------
-- (CS can still create requests, comment, and upload photos — just not
-- edit the request fields or change its status once it exists.)
drop policy if exists "authenticated users can update requests" on requests;

create policy "order taker and admin can update requests"
  on requests for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('order_taker', 'admin')
    )
  );

-- ---------- Order Confirmations: fulfilled lock ----------
-- CS may not update the row at all (no marking fulfilled). Order Taker can
-- update it only while it's still not fulfilled. Once shopify_created is
-- true, only Admin can touch it again (i.e. only Admin can undo it).
drop policy if exists "authenticated users can update order confirmations" on order_confirmations;

create policy "order taker and admin can update order confirmations"
  on order_confirmations for update
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'order_taker')
      and shopify_created = false
    )
  );

-- ---------- Returned by Courier: fulfilled lock ----------
drop policy if exists "authenticated users can update returned by courier" on returned_by_courier;

create policy "order taker and admin can update returned by courier"
  on returned_by_courier for update
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'order_taker')
      and resent = false
    )
  );

-- Note: the app UI already hides/disables these controls for the wrong
-- role or once locked — these policies are the backstop at the database
-- level, so the rule holds even if someone bypasses the app UI.
