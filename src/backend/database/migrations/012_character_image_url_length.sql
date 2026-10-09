ALTER TABLE characters RENAME COLUMN nexon_image_url TO legacy_nexon_image_url;
ALTER TABLE characters ADD COLUMN nexon_image_url TEXT CHECK(nexon_image_url IS NULL OR length(nexon_image_url) <= 8192);
UPDATE characters SET nexon_image_url = legacy_nexon_image_url;
ALTER TABLE characters DROP COLUMN legacy_nexon_image_url;
