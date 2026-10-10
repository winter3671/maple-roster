ALTER TABLE boss_runs ADD COLUMN cycle TEXT NOT NULL DEFAULT 'weekly' CHECK(cycle IN ('weekly', 'monthly'));
CREATE INDEX boss_runs_cycle_period ON boss_runs(cycle, period_start, character_id);
