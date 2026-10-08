CREATE TABLE boss_presets (
  id TEXT PRIMARY KEY NOT NULL,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  boss_key TEXT NOT NULL,
  boss_name TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  party_size INTEGER NOT NULL CHECK(party_size BETWEEN 1 AND 6),
  crystal_price INTEGER NOT NULL CHECK(crystal_price BETWEEN 0 AND 9007199254740991),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(character_id, boss_key)
) STRICT;

CREATE TABLE boss_runs (
  id TEXT PRIMARY KEY NOT NULL,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  world_snapshot TEXT NOT NULL,
  boss_key TEXT NOT NULL,
  boss_name TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  party_size INTEGER NOT NULL CHECK(party_size BETWEEN 1 AND 6),
  crystal_price INTEGER NOT NULL CHECK(crystal_price BETWEEN 0 AND 9007199254740991),
  period_start TEXT NOT NULL,
  is_cleared INTEGER NOT NULL DEFAULT 0 CHECK(is_cleared IN (0, 1)),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes) <= 500),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(character_id, boss_key, period_start)
) STRICT;
CREATE INDEX bosses_by_period ON boss_runs(period_start, character_id);

CREATE TABLE crystal_settlements (
  id TEXT PRIMARY KEY NOT NULL,
  boss_run_id TEXT NOT NULL UNIQUE REFERENCES boss_runs(id) ON DELETE CASCADE,
  sold_on TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount BETWEEN 0 AND 9007199254740991),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

ALTER TABLE ledger_entries RENAME TO ledger_entries_old;
CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY NOT NULL,
  hunting_session_id TEXT REFERENCES hunting_sessions(id) ON DELETE CASCADE,
  crystal_settlement_id TEXT UNIQUE REFERENCES crystal_settlements(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  world_snapshot TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('income', 'expense')),
  amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 9007199254740991),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(hunting_session_id, direction),
  CHECK ((hunting_session_id IS NOT NULL AND crystal_settlement_id IS NULL) OR
         (hunting_session_id IS NULL AND crystal_settlement_id IS NOT NULL AND direction = 'income'))
) STRICT;
INSERT INTO ledger_entries (id, hunting_session_id, character_id, world_snapshot, occurred_on, direction, amount, created_at, updated_at)
SELECT id, hunting_session_id, character_id, world_snapshot, occurred_on, direction, amount, created_at, updated_at FROM ledger_entries_old;
DROP TABLE ledger_entries_old;
CREATE INDEX ledger_by_date ON ledger_entries(occurred_on, character_id);
