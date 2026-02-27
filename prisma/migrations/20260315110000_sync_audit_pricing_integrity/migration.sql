-- Sync audit & pricing integrity foundation
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS source_price_decimal NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS sell_price_decimal NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_hash TEXT;

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  source TEXT NOT NULL DEFAULT 'airalo',
  triggered_by TEXT NOT NULL DEFAULT 'system',
  version TEXT,
  notes TEXT,
  error_summary TEXT,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_run_items (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('country', 'operator', 'package')),
  entity_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'skip', 'error')),
  before_hash TEXT,
  after_hash TEXT,
  diff_json JSONB,
  warning_flags TEXT[] NOT NULL DEFAULT '{}',
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, entity_type, entity_key)
);

CREATE TABLE IF NOT EXISTS entity_snapshots (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('country', 'operator', 'package')),
  entity_key TEXT NOT NULL,
  raw_payload_json JSONB NOT NULL,
  normalized_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_audits (
  id TEXT PRIMARY KEY,
  package_airalo_id TEXT NOT NULL,
  run_id TEXT REFERENCES sync_runs(id) ON DELETE SET NULL,
  source_price NUMERIC(12,4) NOT NULL,
  db_price NUMERIC(12,4),
  published_price NUMERIC(12,4),
  currency TEXT NOT NULL,
  delta_abs NUMERIC(12,4) NOT NULL,
  delta_pct NUMERIC(8,4) NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ignored', 'resolved')),
  resolution_notes TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS publishing_state (
  package_airalo_id TEXT PRIMARY KEY,
  sanity_document_id TEXT,
  published_at TIMESTAMPTZ,
  published_price NUMERIC(12,4),
  published_currency TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);
CREATE INDEX IF NOT EXISTS idx_sync_run_items_run_type ON sync_run_items(run_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_sync_run_items_lookup ON sync_run_items(entity_type, entity_key);
CREATE INDEX IF NOT EXISTS idx_entity_snapshots_lookup ON entity_snapshots(entity_type, entity_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_audits_status_severity ON pricing_audits(status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_audits_run_id ON pricing_audits(run_id);
CREATE INDEX IF NOT EXISTS idx_publishing_state_last_seen ON publishing_state(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_packages_last_synced_at ON packages(last_synced_at DESC);

-- Enable RLS policies (Supabase compatible)
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishing_state ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'admin',
    FALSE
  );
$$;

DROP POLICY IF EXISTS sync_runs_admin_all ON sync_runs;
CREATE POLICY sync_runs_admin_all ON sync_runs
  FOR ALL
  USING (public.is_admin_role())
  WITH CHECK (public.is_admin_role());

DROP POLICY IF EXISTS sync_run_items_admin_all ON sync_run_items;
CREATE POLICY sync_run_items_admin_all ON sync_run_items
  FOR ALL
  USING (public.is_admin_role())
  WITH CHECK (public.is_admin_role());

DROP POLICY IF EXISTS entity_snapshots_admin_all ON entity_snapshots;
CREATE POLICY entity_snapshots_admin_all ON entity_snapshots
  FOR ALL
  USING (public.is_admin_role())
  WITH CHECK (public.is_admin_role());

DROP POLICY IF EXISTS pricing_audits_admin_all ON pricing_audits;
CREATE POLICY pricing_audits_admin_all ON pricing_audits
  FOR ALL
  USING (public.is_admin_role())
  WITH CHECK (public.is_admin_role());

DROP POLICY IF EXISTS publishing_state_admin_all ON publishing_state;
CREATE POLICY publishing_state_admin_all ON publishing_state
  FOR ALL
  USING (public.is_admin_role())
  WITH CHECK (public.is_admin_role());
