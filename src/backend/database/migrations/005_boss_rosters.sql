CREATE TABLE boss_templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 50),
  members_json TEXT NOT NULL
) STRICT;
CREATE TABLE boss_roster_assignments (
  character_id TEXT PRIMARY KEY NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES boss_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  customized INTEGER NOT NULL DEFAULT 0 CHECK(customized IN (0, 1))
) STRICT;
INSERT INTO boss_roster_assignments(character_id, name, customized)
SELECT DISTINCT character_id, '기존 보스 구성', 1 FROM boss_presets;
