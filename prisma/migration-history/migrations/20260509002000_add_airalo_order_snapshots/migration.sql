CREATE TABLE IF NOT EXISTS airalo_order_snapshots (
  id TEXT PRIMARY KEY,
  order_id TEXT NULL REFERENCES "EsimOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  source TEXT NOT NULL,
  request_id TEXT NULL,
  order_number TEXT NULL,
  raw_payload_json JSONB NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_airalo_order_snapshots_order_id ON airalo_order_snapshots(order_id);
CREATE INDEX IF NOT EXISTS idx_airalo_order_snapshots_request_id ON airalo_order_snapshots(request_id);
CREATE INDEX IF NOT EXISTS idx_airalo_order_snapshots_order_number ON airalo_order_snapshots(order_number);
CREATE INDEX IF NOT EXISTS idx_airalo_order_snapshots_source_created_at ON airalo_order_snapshots(source, created_at);
