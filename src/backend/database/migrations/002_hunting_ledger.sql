CREATE TABLE hunting_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  world_snapshot TEXT NOT NULL,
  activity_date TEXT NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes BETWEEN 0 AND 1440),
  mesos INTEGER NOT NULL CHECK (mesos BETWEEN 0 AND 9007199254740991),
  cost INTEGER NOT NULL CHECK (cost BETWEEN 0 AND 9007199254740991),
  sol_fragments INTEGER NOT NULL CHECK (sol_fragments BETWEEN 0 AND 1000000),
  nodestones INTEGER NOT NULL CHECK (nodestones BETWEEN 0 AND 1000000),
  notes TEXT NOT NULL CHECK (length(notes) <= 500),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX hunting_by_date ON hunting_sessions(activity_date, character_id);

CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY NOT NULL,
  hunting_session_id TEXT NOT NULL REFERENCES hunting_sessions(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  world_snapshot TEXT NOT NULL,
  occurred_on TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  amount INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 9007199254740991),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(hunting_session_id, direction)
) STRICT;

CREATE INDEX ledger_by_date ON ledger_entries(occurred_on, character_id);
