-- ============================================================
-- Adds two new lightweight modules to an existing database:
-- Order Confirmations, and Returned by Courier.
-- Run this once in Supabase's SQL Editor.
-- ============================================================

-- ---------- Order Confirmations ----------
create table if not exists order_confirmations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  order_number text not null,
  shopify_created boolean not null default false,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists order_confirmations_store_idx on order_confirmations(store_id);

create table if not exists order_confirmation_comments (
  id uuid primary key default gen_random_uuid(),
  order_confirmation_id uuid not null references order_confirmations(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists order_confirmation_comments_parent_idx
  on order_confirmation_comments(order_confirmation_id);

alter table order_confirmations enable row level security;
alter table order_confirmation_comments enable row level security;

create policy "authenticated users can read order confirmations"
  on order_confirmations for select
  using (auth.role() = 'authenticated');

create policy "authenticated users can insert order confirmations"
  on order_confirmations for insert
  with check (auth.role() = 'authenticated');

create policy "authenticated users can update order confirmations"
  on order_confirmations for update
  using (auth.role() = 'authenticated');

create policy "authenticated users can read order confirmation comments"
  on order_confirmation_comments for select
  using (auth.role() = 'authenticated');

create policy "authenticated users can insert order confirmation comments"
  on order_confirmation_comments for insert
  with check (auth.role() = 'authenticated');

-- ---------- Returned by Courier ----------
create table if not exists returned_by_courier (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  order_number text not null,
  courier text not null default '',
  resent boolean not null default false,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists returned_by_courier_store_idx on returned_by_courier(store_id);

create table if not exists returned_by_courier_comments (
  id uuid primary key default gen_random_uuid(),
  returned_by_courier_id uuid not null references returned_by_courier(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists returned_by_courier_comments_parent_idx
  on returned_by_courier_comments(returned_by_courier_id);

alter table returned_by_courier enable row level security;
alter table returned_by_courier_comments enable row level security;

create policy "authenticated users can read returned by courier"
  on returned_by_courier for select
  using (auth.role() = 'authenticated');

create policy "authenticated users can insert returned by courier"
  on returned_by_courier for insert
  with check (auth.role() = 'authenticated');

create policy "authenticated users can update returned by courier"
  on returned_by_courier for update
  using (auth.role() = 'authenticated');

create policy "authenticated users can read returned by courier comments"
  on returned_by_courier_comments for select
  using (auth.role() = 'authenticated');

create policy "authenticated users can insert returned by courier comments"
  on returned_by_courier_comments for insert
  with check (auth.role() = 'authenticated');

-- Realtime, so new entries and comments show up live
alter publication supabase_realtime add table order_confirmations;
alter publication supabase_realtime add table returned_by_courier;
