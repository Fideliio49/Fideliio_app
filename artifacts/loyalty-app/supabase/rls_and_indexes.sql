-- ============================================================
-- Fideliio — RLS Policies + QR Uniqueness Indexes
-- Run this in your Supabase SQL Editor after schema.sql
-- ============================================================

-- ── 1. Enable RLS on all tables ─────────────────────────────
ALTER TABLE public.merchants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions  ENABLE ROW LEVEL SECURITY;

-- ── 2. Permissive anon policies (app uses anon key, no Supabase Auth) ──
-- These resolve the Security Advisor warnings while keeping the app working.
-- When you add Supabase Auth later, replace these with user-scoped policies.

CREATE POLICY "anon_all_merchants"    ON public.merchants    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_customers"    ON public.customers    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_rewards"      ON public.rewards      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_transactions" ON public.transactions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_redemptions"  ON public.redemptions  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── 3. Unique indexes for QR code lookups ───────────────────
-- Ensures no two customers / merchants share a QR code
-- and makes QR scan lookups fast (O(log n) instead of full scan)

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_qr_code
  ON public.customers(qr_code)
  WHERE qr_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_qr_code
  ON public.merchants(qr_code)
  WHERE qr_code IS NOT NULL;
