ALTER TABLE characters ADD COLUMN nexon_image_url TEXT CHECK(nexon_image_url IS NULL OR length(nexon_image_url) <= 1000);
