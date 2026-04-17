-- ============================================================
-- Fideliio — Fix vues existantes
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1 : Supprimer les vues existantes d'abord
-- ------------------------------------------------------------
DROP VIEW IF EXISTS customer_reward_progress CASCADE;
DROP VIEW IF EXISTS customer_merchant_points CASCADE;
DROP VIEW IF EXISTS customer_total_points CASCADE;
DROP VIEW IF EXISTS merchant_stats CASCADE;

-- ------------------------------------------------------------
-- STEP 2 : Ajouter les colonnes manquantes aux tables
-- ------------------------------------------------------------

-- Ajouter multiplier à transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS multiplier INTEGER NOT NULL DEFAULT 1;

-- Ajouter merchant_id à redemptions
ALTER TABLE public.redemptions
  ADD COLUMN IF NOT EXISTS merchant_id TEXT
  REFERENCES public.merchants(id) ON DELETE CASCADE;

-- Supprimer total_points statique de customers
-- (sera calculé dynamiquement via la vue)
ALTER TABLE public.customers
  DROP COLUMN IF EXISTS total_points;

-- Supprimer stats statiques de merchants
-- (seront calculées dynamiquement via merchant_stats)
ALTER TABLE public.merchants
  DROP COLUMN IF EXISTS total_customers;

ALTER TABLE public.merchants
  DROP COLUMN IF EXISTS points_this_month;

ALTER TABLE public.merchants
  DROP COLUMN IF EXISTS rewards_redeemed;

-- ------------------------------------------------------------
-- STEP 3 : Contraintes unicité QR codes
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_qr_code_unique'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_qr_code_unique UNIQUE (qr_code);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'merchants_qr_code_unique'
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_qr_code_unique UNIQUE (qr_code);
  END IF;
END $$;

-- Index rapides
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_qr_code
  ON public.customers(qr_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_qr_code
  ON public.merchants(qr_code);

CREATE INDEX IF NOT EXISTS idx_transactions_customer
  ON public.transactions(customer_id);

CREATE INDEX IF NOT EXISTS idx_transactions_merchant
  ON public.transactions(merchant_id);

CREATE INDEX IF NOT EXISTS idx_transactions_customer_merchant
  ON public.transactions(customer_id, merchant_id);

-- ------------------------------------------------------------
-- STEP 4 : Recréer les vues proprement
-- ------------------------------------------------------------

-- Vue 1 : Points par client et par commerce
CREATE VIEW customer_merchant_points AS
SELECT
  t.customer_id,
  t.merchant_id,
  m.business_name,
  m.category,
  m.logo_url,
  m.points_rate,
  SUM(t.points_earned)  AS total_points,
  COUNT(*)              AS visit_count,
  MAX(t.created_at)     AS last_visit
FROM public.transactions t
JOIN public.merchants m ON m.id = t.merchant_id
GROUP BY
  t.customer_id,
  t.merchant_id,
  m.business_name,
  m.category,
  m.logo_url,
  m.points_rate;

GRANT SELECT ON customer_merchant_points TO anon, authenticated;

-- Vue 2 : Points globaux par client
CREATE VIEW customer_total_points AS
SELECT
  customer_id,
  SUM(points_earned)  AS total_points,
  COUNT(*)            AS total_transactions
FROM public.transactions
GROUP BY customer_id;

GRANT SELECT ON customer_total_points TO anon, authenticated;

-- Vue 3 : Progression vers prochaine récompense
CREATE VIEW customer_reward_progress AS
SELECT
  cmp.customer_id,
  cmp.merchant_id,
  cmp.business_name,
  cmp.category,
  cmp.total_points                                    AS customer_points,
  r.id                                                AS reward_id,
  r.name                                              AS reward_name,
  r.points_required                                   AS reward_threshold,
  LEAST(
    ROUND(
      (cmp.total_points::NUMERIC / NULLIF(r.points_required, 0)) * 100
    ), 100
  )                                                   AS progress_percent,
  GREATEST(r.points_required - cmp.total_points, 0)  AS points_remaining
FROM customer_merchant_points cmp
JOIN LATERAL (
  SELECT *
  FROM public.rewards rw
  WHERE rw.merchant_id = cmp.merchant_id
    AND rw.is_active = true
    AND rw.points_required > cmp.total_points
  ORDER BY rw.points_required ASC
  LIMIT 1
) r ON true;

GRANT SELECT ON customer_reward_progress TO anon, authenticated;

-- Vue 4 : Stats dynamiques commerçant
CREATE VIEW merchant_stats AS
SELECT
  m.id                                              AS merchant_id,
  m.business_name,
  COUNT(DISTINCT t.customer_id)                     AS total_customers,
  COALESCE(SUM(
    CASE
      WHEN DATE_TRUNC('month', t.created_at) =
           DATE_TRUNC('month', NOW())
      THEN t.points_earned
      ELSE 0
    END
  ), 0)                                             AS points_this_month,
  COUNT(DISTINCT rd.id)                             AS rewards_redeemed
FROM public.merchants m
LEFT JOIN public.transactions t  ON t.merchant_id = m.id
LEFT JOIN public.redemptions  rd ON rd.merchant_id = m.id
GROUP BY m.id, m.business_name;

GRANT SELECT ON merchant_stats TO anon, authenticated;

-- ------------------------------------------------------------
-- STEP 5 : Fonction tier automatique
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_customer_tier(points INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF points >= 5000 THEN RETURN 'gold';
  ELSIF points >= 1000 THEN RETURN 'silver';
  ELSE RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- STEP 6 : Vérification finale
-- ------------------------------------------------------------
SELECT
  table_name,
  COUNT(*) AS colonnes
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'merchants','customers','rewards',
    'transactions','redemptions'
  )
GROUP BY table_name
ORDER BY table_name;

-- Vérifier les vues créées
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;