-- ============================================================
-- Adds an Amount field to Order Confirmations and Returned by Courier.
-- Run this once in Supabase's SQL Editor.
-- ============================================================

alter table order_confirmations add column if not exists amount numeric;
alter table returned_by_courier add column if not exists amount numeric;
