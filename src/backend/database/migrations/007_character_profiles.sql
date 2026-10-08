ALTER TABLE characters ADD COLUMN nexon_ocid TEXT CHECK (nexon_ocid IS NULL OR length(nexon_ocid) BETWEEN 1 AND 128);
ALTER TABLE characters ADD COLUMN nexon_level INTEGER CHECK (nexon_level IS NULL OR nexon_level BETWEEN 1 AND 1000);
ALTER TABLE characters ADD COLUMN nexon_job TEXT;
ALTER TABLE characters ADD COLUMN nexon_guild TEXT;
ALTER TABLE characters ADD COLUMN nexon_fetched_at TEXT;
CREATE UNIQUE INDEX characters_nexon_ocid ON characters(nexon_ocid) WHERE nexon_ocid IS NOT NULL;
