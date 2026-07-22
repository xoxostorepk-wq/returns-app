-- ============================================================
-- Exchange / Return / Replacement / Reverse Pickup Management
-- Database schema for Supabase (Postgres)
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type user_role as enum ('cs', 'order_taker', 'admin');
create type request_status as enum ('pending', 'packed', 'processed', 'cancelled');
create type request_type as enum ('exchange', 'replacement', 'reverse_pickup', 'other');

-- ---------- Stores ----------
create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into stores (name) values ('Store A'), ('Store B');

-- ---------- Profiles (extends Supabase auth.users) ----------
-- Supabase Auth handles login/password. This table stores role + display name.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'cs',
  -- which store the user last worked in — used to restore their context on login
  last_store_id uuid references stores(id),
  -- per-user notification mute setting
  notifications_muted boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Requests ----------
create table requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  order_number text not null,
  request_type request_type not null,
  request_type_other text, -- filled only when request_type = 'other'
  item_to_send text not null,
  payment_instructions text not null default '',
  status request_status not null default 'pending',
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  packed_at timestamptz,
  packed_by uuid references profiles(id),
  processed_at timestamptz,
  processed_by uuid references profiles(id),
  tracking_number text,
  cancelled_reason text,
  -- true once the 2pm-next-working-day reminder has fired, so it only fires once
  reminder_sent boolean not null default false
);

create index requests_store_idx on requests(store_id);
create index requests_status_idx on requests(status);
create index requests_order_number_idx on requests(order_number);
create index requests_created_at_idx on requests(created_at);

-- ---------- Images attached to a request ----------
create table request_images (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  storage_path text not null, -- path inside the 'request-images' storage bucket
  uploaded_by uuid not null references profiles(id),
  uploaded_at timestamptz not null default now()
);

-- ---------- Comments (open-ended thread, separate from the timeline) ----------
create table request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- Timeline (audit log — every field edit + status change) ----------
create table request_timeline (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  actor_id uuid not null references profiles(id),
  action text not null,       -- e.g. 'created', 'edited', 'packed', 'processed', 'cancelled', 'reminder_sent'
  field_name text,            -- for 'edited' actions: which field changed
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index timeline_request_idx on request_timeline(request_id);

-- ---------- Notifications (in-app, per recipient) ----------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id),
  request_id uuid references requests(id) on delete cascade,
  type text not null,        -- 'new_request', 'manual_reminder', 'auto_reminder'
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on notifications(recipient_id, read);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table requests enable row level security;
alter table request_images enable row level security;
alter table request_comments enable row level security;
alter table request_timeline enable row level security;
alter table notifications enable row level security;

-- Everyone logged in can read all profiles (needed to show "edited by X")
create policy "profiles readable by authenticated users"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Requests: any logged-in user can read/write. Fine-grained action limits
-- (e.g. only Order Taker marks Processed) are enforced in the app layer,
-- since all three roles legitimately need to see and touch the same records.
create policy "authenticated users can read requests"
  on requests for select
  using (auth.role() = 'authenticated');

create policy "authenticated users can insert requests"
  on requests for insert
  with check (auth.role() = 'authenticated');

create policy "authenticated users can update requests"
  on requests for update
  using (auth.role() = 'authenticated');

create policy "images readable by authenticated users"
  on request_images for select
  using (auth.role() = 'authenticated');

create policy "images insertable by authenticated users"
  on request_images for insert
  with check (auth.role() = 'authenticated');

create policy "comments readable by authenticated users"
  on request_comments for select
  using (auth.role() = 'authenticated');

create policy "comments insertable by authenticated users"
  on request_comments for insert
  with check (auth.role() = 'authenticated');

create policy "timeline readable by authenticated users"
  on request_timeline for select
  using (auth.role() = 'authenticated');

create policy "timeline insertable by authenticated users"
  on request_timeline for insert
  with check (auth.role() = 'authenticated');

create policy "users read their own notifications"
  on notifications for select
  using (auth.uid() = recipient_id);

create policy "users update their own notifications"
  on notifications for update
  using (auth.uid() = recipient_id);

create policy "authenticated users can insert notifications"
  on notifications for insert
  with check (auth.role() = 'authenticated');

-- ============================================================
-- Realtime — enable so the notification bell updates live
-- ============================================================
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table requests;

-- ============================================================
-- Daily reminder job
-- Fires once, at 2:00 PM store-local time, for any request created
-- the previous working day that is still not 'processed'.
-- Schedule this function to run via pg_cron (see README) at 14:00
-- every working day (Mon–Sat, since only Sunday is off).
-- ============================================================
create or replace function run_daily_reminders()
returns void
language plpgsql
security definer
as $$
declare
  r record;
  taker record;
begin
  for r in
    select * from requests
    where status <> 'processed'
      and status <> 'cancelled'
      and reminder_sent = false
      -- created on the previous working day (i.e. before today, after the
      -- last working day's start) — simple version: created before today's
      -- start-of-day and after 3 calendar days ago, refine as needed once
      -- your working-day calendar table exists.
      and created_at < date_trunc('day', now())
  loop
    -- notify every order_taker and admin
    for taker in
      select id from profiles where role in ('order_taker', 'admin')
    loop
      insert into notifications (recipient_id, request_id, type, message)
      values (
        taker.id,
        r.id,
        'auto_reminder',
        'Reminder: order ' || r.order_number || ' is still ' || r.status || ' from yesterday.'
      );
    end loop;

    update requests set reminder_sent = true where id = r.id;

    insert into request_timeline (request_id, actor_id, action)
    values (r.id, r.created_by, 'reminder_sent');
  end loop;
end;
$$;
