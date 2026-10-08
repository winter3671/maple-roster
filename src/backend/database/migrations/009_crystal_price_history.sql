CREATE TABLE crystal_price_history (
  id TEXT PRIMARY KEY,
  boss_name TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  effective_on TEXT NOT NULL,
  checked_on TEXT NOT NULL,
  source TEXT NOT NULL,
  UNIQUE(boss_name, difficulty, effective_on)
) STRICT;
