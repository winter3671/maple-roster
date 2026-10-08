CREATE TABLE manual_expenses (
  id TEXT PRIMARY KEY NOT NULL,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  world_snapshot TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('장비 구매', '강화', '큐브', '아이템 구매', '기타')),
  amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 9007199254740991),
  notes TEXT NOT NULL CHECK(length(notes) <= 500),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

ALTER TABLE ledger_entries RENAME TO ledger_entries_previous;
CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY NOT NULL,
  hunting_session_id TEXT REFERENCES hunting_sessions(id) ON DELETE CASCADE,
  crystal_settlement_id TEXT UNIQUE REFERENCES crystal_settlements(id) ON DELETE CASCADE,
  drop_sale_id TEXT UNIQUE REFERENCES drop_sales(id) ON DELETE CASCADE,
  manual_expense_id TEXT UNIQUE REFERENCES manual_expenses(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  world_snapshot TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('income', 'expense')),
  amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 9007199254740991),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(hunting_session_id, direction),
  CHECK (
    (hunting_session_id IS NOT NULL AND crystal_settlement_id IS NULL AND drop_sale_id IS NULL AND manual_expense_id IS NULL)
    OR (hunting_session_id IS NULL AND crystal_settlement_id IS NOT NULL AND drop_sale_id IS NULL AND manual_expense_id IS NULL AND direction = 'income')
    OR (hunting_session_id IS NULL AND crystal_settlement_id IS NULL AND drop_sale_id IS NOT NULL AND manual_expense_id IS NULL AND direction = 'income')
    OR (hunting_session_id IS NULL AND crystal_settlement_id IS NULL AND drop_sale_id IS NULL AND manual_expense_id IS NOT NULL AND direction = 'expense')
  )
) STRICT;
INSERT INTO ledger_entries (id, hunting_session_id, crystal_settlement_id, drop_sale_id, character_id, world_snapshot, occurred_on, direction, amount, created_at, updated_at)
SELECT id, hunting_session_id, crystal_settlement_id, drop_sale_id, character_id, world_snapshot, occurred_on, direction, amount, created_at, updated_at FROM ledger_entries_previous;
DROP TABLE ledger_entries_previous;
CREATE INDEX ledger_entries_by_date ON ledger_entries(occurred_on, character_id);
