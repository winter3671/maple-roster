UPDATE characters SET is_hidden = 0;
CREATE TABLE weekly_content_snapshots (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  week TEXT NOT NULL,
  ocid TEXT NOT NULL,
  contents_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY(character_id, week)
) STRICT;
