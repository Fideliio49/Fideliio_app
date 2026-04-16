-- ============================================================
-- Fideliio — Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- ============================================================

-- Merchants
CREATE TABLE IF NOT EXISTS merchants (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  business_name   TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other',
  logo_url        TEXT,
  points_rate     INTEGER NOT NULL DEFAULT 1,
  total_customers INTEGER NOT NULL DEFAULT 0,
  points_this_month INTEGER NOT NULL DEFAULT 0,
  rewards_redeemed  INTEGER NOT NULL DEFAULT 0,
  qr_code         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  total_points INTEGER NOT NULL DEFAULT 0,
  tier         TEXT NOT NULL DEFAULT 'bronze',
  qr_code      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rewards
CREATE TABLE IF NOT EXISTS rewards (
  id              TEXT PRIMARY KEY,
  merchant_id     TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  merchant_name   TEXT,
  name            TEXT NOT NULL,
  points_required INTEGER NOT NULL,
  reward_type     TEXT NOT NULL DEFAULT 'freeProduct',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  expiry_date     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT PRIMARY KEY,
  customer_id   TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  merchant_id   TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  merchant_name TEXT NOT NULL DEFAULT '',
  customer_name TEXT,
  amount        NUMERIC NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Redemptions
CREATE TABLE IF NOT EXISTS redemptions (
  id            TEXT PRIMARY KEY,
  customer_id   TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reward_id     TEXT NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  reward_name   TEXT NOT NULL DEFAULT '',
  merchant_name TEXT NOT NULL DEFAULT '',
  redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Disable RLS so the anon key can read/write ----
ALTER TABLE merchants   DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers   DISABLE ROW LEVEL SECURITY;
ALTER TABLE rewards     DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions  DISABLE ROW LEVEL SECURITY;

GRANT ALL ON merchants    TO anon, authenticated;
GRANT ALL ON customers    TO anon, authenticated;
GRANT ALL ON rewards      TO anon, authenticated;
GRANT ALL ON transactions TO anon, authenticated;
GRANT ALL ON redemptions  TO anon, authenticated;

-- ---- Demo seed data ----
INSERT INTO merchants (id, user_id, business_name, category, points_rate, total_customers, points_this_month, rewards_redeemed, qr_code) VALUES
  ('m1', 'u_m1', 'Café Atlas',     'restaurant', 1, 42, 3200, 8,  'FID-MERCH-CAFATLAS'),
  ('m2', 'u_m2', 'Boutique Lina',  'clothing',   2, 28, 1800, 5,  'FID-MERCH-BOUTLINA'),
  ('m3', 'u_m3', 'Salon Zara',     'hairSalon',  1, 35, 2400, 12, 'FID-MERCH-SALNZARA'),
  ('m4', 'u_m4', 'Hôtel Riad',     'hotel',      3, 15, 5000, 3,  'FID-MERCH-HOTELRIAD')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rewards (id, merchant_id, merchant_name, name, points_required, reward_type, is_active) VALUES
  ('r1', 'm1', 'Café Atlas',    'Café gratuit',      200,  'freeProduct', true),
  ('r2', 'm1', 'Café Atlas',    '10% de réduction',  500,  'discount',    true),
  ('r3', 'm2', 'Boutique Lina', '20% sur tout',      1000, 'discount',    true),
  ('r4', 'm3', 'Salon Zara',    'Coupe gratuite',    800,  'freeService', true),
  ('r5', 'm4', 'Hôtel Riad',    'Nuit offerte',      3000, 'freeService', true)
ON CONFLICT (id) DO NOTHING;
