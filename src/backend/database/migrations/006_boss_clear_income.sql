ALTER TABLE crystal_settlements ADD COLUMN is_automatic INTEGER NOT NULL DEFAULT 0 CHECK(is_automatic IN (0, 1));

-- Backfill cleared records without a previously entered income. Existing amounts,
-- dates and ledger IDs are preserved. Old clear dates are inferred from updated_at
-- only within their week; otherwise the week start is used.
INSERT INTO crystal_settlements(id, boss_run_id, sold_on, amount, created_at, updated_at, is_automatic)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
 r.id,
 CASE WHEN date(r.updated_at, '+9 hours') BETWEEN r.period_start AND date(r.period_start, '+6 days') THEN date(r.updated_at, '+9 hours') ELSE r.period_start END,
 r.crystal_price / r.party_size, r.created_at, r.updated_at, 1
FROM boss_runs r WHERE r.is_cleared=1 AND NOT EXISTS(SELECT 1 FROM crystal_settlements s WHERE s.boss_run_id=r.id);

INSERT INTO ledger_entries(id, crystal_settlement_id, character_id, world_snapshot, occurred_on, direction, amount, created_at, updated_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
 s.id, r.character_id, r.world_snapshot, s.sold_on, 'income', s.amount, s.created_at, s.updated_at
FROM crystal_settlements s JOIN boss_runs r ON r.id=s.boss_run_id
WHERE s.is_automatic=1 AND s.amount>0 AND NOT EXISTS(SELECT 1 FROM ledger_entries e WHERE e.crystal_settlement_id=s.id);
