-- ============================================================
-- Adds an Amount field to requests, and cleans up any leftover
-- references to a deleted store. Run once in Supabase's SQL Editor.
-- ============================================================

alter table requests add column if not exists amount numeric;

-- If anyone's saved "last store" points at a store that no longer exists
-- (e.g. after deleting MadColors), reset it to whichever store remains —
-- this is what was causing "select store" / failed request creation.
update profiles
set last_store_id = (select id from stores order by created_at limit 1)
where last_store_id is not null
  and last_store_id not in (select id from stores);
