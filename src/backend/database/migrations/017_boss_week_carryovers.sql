CREATE TABLE boss_week_carryovers (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  PRIMARY KEY (character_id, period_start)
) STRICT;
CREATE INDEX boss_week_carryovers_period ON boss_week_carryovers(period_start);
