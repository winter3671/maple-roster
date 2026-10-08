CREATE TABLE drop_lots (
  id TEXT PRIMARY KEY NOT NULL,
  hunting_session_id TEXT REFERENCES hunting_sessions(id) ON DELETE CASCADE,
  boss_run_id TEXT REFERENCES boss_runs(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  world_snapshot TEXT NOT NULL,
  acquired_on TEXT NOT NULL,
  item_name TEXT NOT NULL,
  managed_kind TEXT CHECK(managed_kind IN ('sol_fragment', 'nodestone')),
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),
  estimated_unit_price INTEGER NOT NULL CHECK(estimated_unit_price BETWEEN 0 AND 9007199254740991),
  party_size INTEGER NOT NULL CHECK(party_size BETWEEN 1 AND 6),
  notes TEXT NOT NULL CHECK(length(notes) <= 500),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(hunting_session_id, managed_kind),
  CHECK ((hunting_session_id IS NOT NULL AND boss_run_id IS NULL) OR (hunting_session_id IS NULL AND boss_run_id IS NOT NULL AND managed_kind IS NULL))
) STRICT;
CREATE INDEX drops_by_boss ON drop_lots(boss_run_id);
CREATE TABLE drop_sales (
  id TEXT PRIMARY KEY NOT NULL,
  drop_lot_id TEXT NOT NULL REFERENCES drop_lots(id) ON DELETE RESTRICT,
  sold_on TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),
  gross_amount INTEGER NOT NULL CHECK(gross_amount BETWEEN 0 AND 9007199254740991),
  fee_amount INTEGER NOT NULL CHECK(fee_amount BETWEEN 0 AND gross_amount),
  party_size INTEGER NOT NULL CHECK(party_size BETWEEN 1 AND 6),
  share_mode TEXT NOT NULL CHECK(share_mode IN ('equal', 'manual')),
  manual_share INTEGER CHECK(manual_share BETWEEN 0 AND gross_amount - fee_amount),
  net_share INTEGER NOT NULL CHECK(net_share BETWEEN 0 AND gross_amount - fee_amount),
  estimated_unit_price INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((share_mode = 'equal' AND manual_share IS NULL) OR (share_mode = 'manual' AND manual_share IS NOT NULL))
) STRICT;
CREATE INDEX sales_by_lot ON drop_sales(drop_lot_id);

INSERT INTO drop_lots (id, hunting_session_id, character_id, world_snapshot, acquired_on, item_name, managed_kind, quantity, estimated_unit_price, party_size, notes, created_at, updated_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))), id, character_id, world_snapshot, activity_date, '솔 에르다 조각', 'sol_fragment', sol_fragments, 0, 1, '', created_at, updated_at FROM hunting_sessions WHERE sol_fragments > 0;
INSERT INTO drop_lots (id, hunting_session_id, character_id, world_snapshot, acquired_on, item_name, managed_kind, quantity, estimated_unit_price, party_size, notes, created_at, updated_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))), id, character_id, world_snapshot, activity_date, '코어 젬스톤', 'nodestone', nodestones, 0, 1, '', created_at, updated_at FROM hunting_sessions WHERE nodestones > 0;

ALTER TABLE ledger_entries RENAME TO ledger_entries_old;
CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY NOT NULL,
  hunting_session_id TEXT REFERENCES hunting_sessions(id) ON DELETE CASCADE,
  crystal_settlement_id TEXT UNIQUE REFERENCES crystal_settlements(id) ON DELETE CASCADE,
  drop_sale_id TEXT UNIQUE REFERENCES drop_sales(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  world_snapshot TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('income', 'expense')),
  amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 9007199254740991),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(hunting_session_id, direction),
  CHECK ((hunting_session_id IS NOT NULL AND crystal_settlement_id IS NULL AND drop_sale_id IS NULL) OR
         (hunting_session_id IS NULL AND crystal_settlement_id IS NOT NULL AND drop_sale_id IS NULL AND direction = 'income') OR
         (hunting_session_id IS NULL AND crystal_settlement_id IS NULL AND drop_sale_id IS NOT NULL AND direction = 'income'))
) STRICT;
INSERT INTO ledger_entries (id, hunting_session_id, crystal_settlement_id, character_id, world_snapshot, occurred_on, direction, amount, created_at, updated_at)
SELECT id, hunting_session_id, crystal_settlement_id, character_id, world_snapshot, occurred_on, direction, amount, created_at, updated_at FROM ledger_entries_old;
DROP TABLE ledger_entries_old;
CREATE INDEX ledger_by_date ON ledger_entries(occurred_on, character_id);
