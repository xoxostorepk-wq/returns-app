-- ============================================================
-- Fix: fulfilled-lock RLS bug
-- The previous policies only had a USING clause. For UPDATE, Postgres
-- reuses USING as the WITH CHECK when none is given — so when Order
-- Taker flipped shopify_created/resent from false to true, the new row
-- (now true) was checked against "...and shopify_created = false" and
-- silently rejected. That's why it looked locked on screen but reverted
-- to Pending after a refresh: the write never actually saved.
-- ============================================================

drop policy if exists "order taker and admin can update order confirmations" on order_confirmations;

create policy "order taker and admin can update order confirmations"
  on order_confirmations for update
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'order_taker')
      and shopify_created = false
    )
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'order_taker'))
  );

drop policy if exists "order taker and admin can update returned by courier" on returned_by_courier;

create policy "order taker and admin can update returned by courier"
  on returned_by_courier for update
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'order_taker')
      and resent = false
    )
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'order_taker'))
  );

-- ============================================================
-- Duplicate order-number check, per tab
-- Same order number can't appear twice within the same tab (two CS
-- agents entering the same order independently, etc.) but the same
-- order number CAN appear once in Requests, once in Confirmations, and
-- once in Returned by Courier — those are separate checks, not one
-- check across everything.
-- Matching ignores case and surrounding spaces (so "#1535" and " #1535 "
-- count as the same order number).
-- ============================================================

create unique index if not exists requests_store_order_unique
  on requests (store_id, lower(btrim(order_number)));

create unique index if not exists order_confirmations_store_order_unique
  on order_confirmations (store_id, lower(btrim(order_number)));

create unique index if not exists returned_by_courier_store_order_unique
  on returned_by_courier (store_id, lower(btrim(order_number)));

-- Note: if any duplicates already exist from before, this migration will
-- fail to create the index until they're resolved. If you get an error
-- here, tell me the order number(s) it mentions and I'll help you sort
-- out which entry to keep before re-running this.
