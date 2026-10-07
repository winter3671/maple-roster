CREATE TABLE characters (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  world TEXT NOT NULL CHECK (length(world) BETWEEN 1 AND 40),
  identity_key TEXT NOT NULL UNIQUE,
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
