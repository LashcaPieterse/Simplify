ALTER TABLE package_sync_pages
  ADD COLUMN IF NOT EXISTS raw_payload_json JSONB;
