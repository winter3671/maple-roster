ALTER TABLE manual_expenses ADD COLUMN currency TEXT NOT NULL DEFAULT 'meso' CHECK(currency IN ('meso', 'maplePoint'));
ALTER TABLE manual_expenses ADD COLUMN point_amount INTEGER CHECK(point_amount IS NULL OR point_amount BETWEEN 1 AND 9007199254740991);
ALTER TABLE manual_expenses ADD COLUMN points_per_100m INTEGER CHECK(
  (currency = 'meso' AND point_amount IS NULL AND points_per_100m IS NULL)
  OR (currency = 'maplePoint' AND point_amount IS NOT NULL AND points_per_100m IS NOT NULL AND points_per_100m BETWEEN 1 AND 9007199254740991)
);
