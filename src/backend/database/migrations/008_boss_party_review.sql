ALTER TABLE boss_runs ADD COLUMN party_size_needs_review INTEGER NOT NULL DEFAULT 0 CHECK (party_size_needs_review IN (0, 1));
