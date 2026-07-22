# Returns & Exchange Tracker — Setup Guide

This replaces the WhatsApp/group-chat workflow with a proper internal tool.
No server to manage — everything runs on free tiers of two services:

- **Supabase** — your database, login system, and image storage
- **Vercel** — hosts the actual website, connects to Supabase

Follow these steps in order. Total time: about 30–45 minutes the first time.

---

## 1. Create your Supabase project

1. Go to https://supabase.com → sign up (free) → **New project**.
2. Pick any project name (e.g. "returns-tracker"), set a database password
   (save it somewhere safe), pick the region closest to you.
3. Wait ~2 minutes for it to finish setting up.

## 2. Set up the database

1. In your Supabase project, open **SQL Editor** (left sidebar).
2. Open the file `supabase/schema.sql` from this project, copy the whole
   thing, paste it into the SQL Editor, and click **Run**.
3. This creates all the tables, security rules, and the two stores
   ("Store A" / "Store B" — rename these in the `stores` table if you want
   different names, e.g. your actual store names).

## 3. Create the image storage bucket

1. In Supabase, go to **Storage** → **New bucket**.
2. Name it exactly: `request-images`
3. Leave it **private** (not public) — the app generates secure temporary
   links to view images, so it doesn't need to be public.

## 4. Get your API keys

1. In Supabase, go to **Project Settings** → **API**.
2. You'll need three values for the next step:
   - **Project URL**
   - **anon public** key
   - **service_role** key (click "reveal" — keep this one secret)

## 5. Create your first Admin account

1. In Supabase, go to **Authentication** → **Users** → **Add user** →
   **Create new user**. Enter your own email and a password. Tick
   "Auto Confirm User".
2. Go to **Table Editor** → `profiles` table → **Insert row**:
   - `id`: paste the user ID you just created (copy it from the Users list)
   - `full_name`: your name
   - `role`: `admin`
   - Leave the rest as default.
3. This is the only account you create manually — once you're logged in
   as Admin, use the **Users** page inside the app to create everyone
   else (CS agents, Order Taker).

## 6. Deploy the app to Vercel

1. Push this project folder to a GitHub repository (create a free GitHub
   account if needed, create a new repo, upload these files).
2. Go to https://vercel.com → sign up free → **Add New Project** →
   import that GitHub repo.
3. Before deploying, add these **Environment Variables** (from step 4):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Click **Deploy**. Vercel gives you a live URL
   (like `returns-tracker.vercel.app`) — this is the link everyone uses.

## 7. Schedule the automatic 2pm reminder

This uses Supabase's built-in scheduler (pg_cron), so nothing needs to run
on your own computer.

1. In Supabase SQL Editor, run:
   ```sql
   create extension if not exists pg_cron;

   select cron.schedule(
     'daily-return-reminders',
     '0 14 * * 1-6',  -- 2:00 PM, Monday–Saturday (Sunday skipped)
     $$ select run_daily_reminders(); $$
   );
   ```
2. **Important:** that `14` is in UTC by default. Adjust it to match
   2:00 PM in your local time zone (e.g. if you're UTC+5, use `9` instead
   of `14`). If you're not sure of your offset, search "my timezone UTC
   offset" and adjust the number.

## 8. Try it out

1. Open your Vercel URL, log in as Admin.
2. Go to **Users**, create a CS account and an Order Taker account.
3. Log out, log in as CS, create a test request.
4. Log in as Order Taker (or Admin) in another browser/incognito window —
   you should see the notification appear live, and the request in the
   queue.

---

## What's in Version 1

- Create / edit requests (Exchange, Replacement, Reverse Pickup, Other)
  with photo uploads and comments
- Full edit timeline (who changed what, and when — like a Shopify order
  timeline)
- Status flow: Pending → Packed → Processed, with tracking number entry
- Printable A4 slips, single or multiple at once
- Store switcher (two stores, same login)
- Live in-app notifications with mute, plus manual + automatic (2pm
  next-working-day) reminders
- Admin: user management, cancel requests (with reason), full access

## Deliberately left out of Version 1 (for later)

- Shopify integration (all data is entered manually for now)
- Courier API integration (tracking numbers are typed in manually)
- Reports/analytics dashboard and Excel export
- Refund/amount tracking (this tool is return/exchange workflow only)

## Getting help

If something doesn't work as expected, the most common causes are:
- Environment variables not set correctly on Vercel (step 6)
- Forgetting to run the SQL schema (step 2) before first use
- The storage bucket name not matching `request-images` exactly (step 3)

Come back to this conversation any time you want to add a feature, fix a
bug, or move into Version 2 (Shopify integration, reports, etc.) — the
codebase is structured so new modules can be added without a redesign.
