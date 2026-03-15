-- Strict API-aligned catalog refactor:
-- - API-pure packages table
-- - package_state sidecar for internal commerce/sync fields
-- - countries/operators aligned with Airalo list-packages response
-- - package_sync_pages for links/meta/pricing page snapshots

-- 1) Countries alignment
ALTER TABLE countries
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS image_json JSONB;

UPDATE countries
SET
  title = COALESCE(title, name, country_code),
  image_json = COALESCE(
    image_json,
    CASE
      WHEN image_url IS NOT NULL THEN jsonb_build_object('url', image_url)
      ELSE NULL
    END
  );

ALTER TABLE countries
  ALTER COLUMN title SET NOT NULL;

ALTER TABLE countries
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS image_url,
  DROP COLUMN IF EXISTS flag_url,
  DROP COLUMN IF EXISTS metadata;

-- 2) Operators alignment
ALTER TABLE operators
  ADD COLUMN IF NOT EXISTS airalo_operator_id INTEGER,
  ADD COLUMN IF NOT EXISTS activation_policy TEXT,
  ADD COLUMN IF NOT EXISTS apn JSONB,
  ADD COLUMN IF NOT EXISTS apn_type TEXT,
  ADD COLUMN IF NOT EXISTS apn_value TEXT,
  ADD COLUMN IF NOT EXISTS countries_json JSONB,
  ADD COLUMN IF NOT EXISTS coverages_json JSONB,
  ADD COLUMN IF NOT EXISTS esim_type TEXT,
  ADD COLUMN IF NOT EXISTS gradient_end TEXT,
  ADD COLUMN IF NOT EXISTS gradient_start TEXT,
  ADD COLUMN IF NOT EXISTS image_json JSONB,
  ADD COLUMN IF NOT EXISTS info TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS install_window_days INTEGER,
  ADD COLUMN IF NOT EXISTS is_kyc_verify BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_prepaid BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_roaming BOOLEAN,
  ADD COLUMN IF NOT EXISTS other_info TEXT,
  ADD COLUMN IF NOT EXISTS plan_type TEXT,
  ADD COLUMN IF NOT EXISTS rechargeability BOOLEAN,
  ADD COLUMN IF NOT EXISTS style TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS topup_grace_window_days INTEGER,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS warning JSONB;

UPDATE operators
SET
  airalo_operator_id = COALESCE(airalo_operator_id, api_operator_id),
  title = COALESCE(title, metadata->>'title', name, operator_code, 'Unknown'),
  activation_policy = COALESCE(activation_policy, metadata->>'activation_policy'),
  apn = COALESCE(apn, metadata->'apn'),
  apn_type = COALESCE(apn_type, metadata->>'apn_type'),
  apn_value = COALESCE(apn_value, metadata->>'apn_value'),
  countries_json = COALESCE(countries_json, metadata->'countries'),
  coverages_json = COALESCE(coverages_json, metadata->'coverages'),
  esim_type = COALESCE(esim_type, metadata->>'esim_type'),
  gradient_end = COALESCE(gradient_end, metadata->>'gradient_end'),
  gradient_start = COALESCE(gradient_start, metadata->>'gradient_start'),
  image_json = COALESCE(image_json, metadata->'image'),
  info = CASE
    WHEN array_length(info, 1) IS NOT NULL AND array_length(info, 1) > 0 THEN info
    WHEN jsonb_typeof(metadata->'info') = 'array' THEN ARRAY(
      SELECT jsonb_array_elements_text(metadata->'info')
    )
    ELSE '{}'
  END,
  install_window_days = COALESCE(install_window_days, NULLIF(metadata->>'install_window_days', '')::INTEGER),
  is_kyc_verify = COALESCE(is_kyc_verify, NULLIF(metadata->>'is_kyc_verify', '')::BOOLEAN),
  is_prepaid = COALESCE(is_prepaid, NULLIF(metadata->>'is_prepaid', '')::BOOLEAN),
  is_roaming = COALESCE(is_roaming, NULLIF(metadata->>'is_roaming', '')::BOOLEAN),
  other_info = COALESCE(other_info, metadata->>'other_info'),
  plan_type = COALESCE(plan_type, metadata->>'plan_type'),
  rechargeability = COALESCE(rechargeability, NULLIF(metadata->>'rechargeability', '')::BOOLEAN),
  style = COALESCE(style, metadata->>'style'),
  topup_grace_window_days = COALESCE(topup_grace_window_days, NULLIF(metadata->>'topup_grace_window_days', '')::INTEGER),
  type = COALESCE(type, metadata->>'type'),
  warning = COALESCE(warning, metadata->'warning');

ALTER TABLE operators
  ALTER COLUMN title SET NOT NULL;

ALTER TABLE operators
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS api_operator_id,
  DROP COLUMN IF EXISTS operator_code,
  DROP COLUMN IF EXISTS network_types,
  DROP COLUMN IF EXISTS metadata;

-- 3) Packages API columns + backfill
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS airalo_package_id TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS amount INTEGER,
  ADD COLUMN IF NOT EXISTS data TEXT,
  ADD COLUMN IF NOT EXISTS day INTEGER,
  ADD COLUMN IF NOT EXISTS net_price NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS price NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS prices_net_price JSONB,
  ADD COLUMN IF NOT EXISTS prices_recommended_retail_price JSONB,
  ADD COLUMN IF NOT EXISTS text INTEGER,
  ADD COLUMN IF NOT EXISTS voice INTEGER;

UPDATE packages
SET
  airalo_package_id = COALESCE(airalo_package_id, external_id),
  type = COALESCE(type, metadata->>'type', 'sim'),
  title = COALESCE(title, metadata->>'title', name, external_id),
  amount = COALESCE(amount, NULLIF(metadata->>'amount', '')::INTEGER, data_amount_mb, 0),
  data = COALESCE(
    data,
    metadata->>'data',
    CASE
      WHEN data_amount_mb IS NOT NULL THEN CONCAT(data_amount_mb::TEXT, ' MB')
      ELSE '0 MB'
    END
  ),
  day = COALESCE(day, NULLIF(metadata->>'day', '')::INTEGER, validity_days, 0),
  is_unlimited = COALESCE(is_unlimited, FALSE),
  manual_installation = COALESCE(manual_installation, ''),
  qr_installation = COALESCE(qr_installation, ''),
  is_fair_usage_policy = COALESCE(is_fair_usage_policy, NULLIF(metadata->>'is_fair_usage_policy', '')::BOOLEAN),
  fair_usage_policy = COALESCE(fair_usage_policy, metadata->>'fair_usage_policy'),
  net_price = COALESCE(
    net_price,
    NULLIF(metadata->>'net_price', '')::NUMERIC,
    NULLIF(net_price_json->>'USD', '')::NUMERIC,
    CASE WHEN price_cents IS NOT NULL THEN (price_cents::NUMERIC / 100) ELSE NULL END
  ),
  price = COALESCE(
    price,
    NULLIF(metadata->>'price', '')::NUMERIC,
    NULLIF(rrp_price_json->>'USD', '')::NUMERIC,
    CASE
      WHEN selling_price_cents IS NOT NULL THEN (selling_price_cents::NUMERIC / 100)
      WHEN price_cents IS NOT NULL THEN (price_cents::NUMERIC / 100)
      ELSE 0
    END
  ),
  prices_net_price = COALESCE(prices_net_price, net_price_json, metadata#>'{prices,net_price}'),
  prices_recommended_retail_price = COALESCE(
    prices_recommended_retail_price,
    rrp_price_json,
    metadata#>'{prices,recommended_retail_price}'
  ),
  short_info = COALESCE(short_info, metadata->>'short_info'),
  text = COALESCE(text, NULLIF(metadata->>'text', '')::INTEGER),
  voice = COALESCE(voice, NULLIF(metadata->>'voice', '')::INTEGER, voice_minutes);

ALTER TABLE packages
  ALTER COLUMN airalo_package_id SET NOT NULL,
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN amount SET NOT NULL,
  ALTER COLUMN data SET NOT NULL,
  ALTER COLUMN day SET NOT NULL,
  ALTER COLUMN manual_installation SET NOT NULL,
  ALTER COLUMN qr_installation SET NOT NULL,
  ALTER COLUMN price SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'packages_external_id_key'
  ) THEN
    ALTER TABLE packages DROP CONSTRAINT packages_external_id_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'packages_airalo_package_id_key'
  ) THEN
    ALTER TABLE packages ADD CONSTRAINT packages_airalo_package_id_key UNIQUE (airalo_package_id);
  END IF;
END
$$;

-- 4) Internal state sidecar
CREATE TABLE IF NOT EXISTS package_state (
  package_id UUID PRIMARY KEY REFERENCES packages(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at TIMESTAMPTZ,
  base_price_cents INTEGER NOT NULL DEFAULT 0,
  selling_price_cents INTEGER,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  source_price_decimal NUMERIC(12,4),
  sell_price_decimal NUMERIC(12,4),
  last_synced_at TIMESTAMPTZ,
  source_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO package_state (
  package_id,
  is_active,
  deactivated_at,
  base_price_cents,
  selling_price_cents,
  currency_code,
  source_price_decimal,
  sell_price_decimal,
  last_synced_at,
  source_hash,
  created_at,
  updated_at
)
SELECT
  p.id,
  COALESCE(p.is_active, TRUE),
  p.deactivated_at,
  COALESCE(ROUND(COALESCE(p.net_price, p.price, 0) * 100)::INTEGER, 0),
  COALESCE(p.selling_price_cents, ROUND(COALESCE(p.price, 0) * 100)::INTEGER),
  COALESCE(p.currency_code, 'USD'),
  p.source_price_decimal,
  p.sell_price_decimal,
  p.last_synced_at,
  p.source_hash,
  p.created_at,
  p.updated_at
FROM packages p
ON CONFLICT (package_id)
DO UPDATE SET
  is_active = EXCLUDED.is_active,
  deactivated_at = EXCLUDED.deactivated_at,
  base_price_cents = EXCLUDED.base_price_cents,
  selling_price_cents = EXCLUDED.selling_price_cents,
  currency_code = EXCLUDED.currency_code,
  source_price_decimal = EXCLUDED.source_price_decimal,
  sell_price_decimal = EXCLUDED.sell_price_decimal,
  last_synced_at = EXCLUDED.last_synced_at,
  source_hash = EXCLUDED.source_hash,
  updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_package_state_is_active ON package_state(is_active);
CREATE INDEX IF NOT EXISTS idx_package_state_last_synced_at ON package_state(last_synced_at DESC);

-- 5) Per-page list-packages envelope persistence
CREATE TABLE IF NOT EXISTS package_sync_pages (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  "limit" INTEGER NOT NULL,
  links_json JSONB,
  meta_json JSONB,
  pricing_json JSONB,
  country_count INTEGER NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, page)
);

CREATE INDEX IF NOT EXISTS idx_package_sync_pages_captured_at ON package_sync_pages(captured_at DESC);

-- 6) Remove non-API package columns
DROP INDEX IF EXISTS packages_country_id_idx;

ALTER TABLE packages
  DROP CONSTRAINT IF EXISTS packages_country_id_fkey;

ALTER TABLE packages
  DROP COLUMN IF EXISTS country_id,
  DROP COLUMN IF EXISTS external_id,
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS sim_type,
  DROP COLUMN IF EXISTS is_rechargeable,
  DROP COLUMN IF EXISTS network_types,
  DROP COLUMN IF EXISTS voice_minutes,
  DROP COLUMN IF EXISTS sms,
  DROP COLUMN IF EXISTS apn,
  DROP COLUMN IF EXISTS iccid,
  DROP COLUMN IF EXISTS smdp_address,
  DROP COLUMN IF EXISTS qr_code_data,
  DROP COLUMN IF EXISTS qr_code_url,
  DROP COLUMN IF EXISTS activation_code,
  DROP COLUMN IF EXISTS topup_parent_id,
  DROP COLUMN IF EXISTS data_amount_mb,
  DROP COLUMN IF EXISTS validity_days,
  DROP COLUMN IF EXISTS price_cents,
  DROP COLUMN IF EXISTS selling_price_cents,
  DROP COLUMN IF EXISTS currency_code,
  DROP COLUMN IF EXISTS net_price_json,
  DROP COLUMN IF EXISTS rrp_price_json,
  DROP COLUMN IF EXISTS image_url,
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS source_price_decimal,
  DROP COLUMN IF EXISTS sell_price_decimal,
  DROP COLUMN IF EXISTS last_synced_at,
  DROP COLUMN IF EXISTS source_hash,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS deactivated_at;
