-- ============================================================
-- Batch: optional Courier + Notes fields
-- Confirmations gets an optional Courier field and an optional Notes
-- field. Returned by Courier (which already has Courier) gets an
-- optional Notes field.
-- Run this once in Supabase SQL Editor (after the earlier migrations).
-- ============================================================

alter table order_confirmations
  add column if not exists courier text,
  add column if not exists notes text;

alter table returned_by_courier
  add column if not exists notes text;
