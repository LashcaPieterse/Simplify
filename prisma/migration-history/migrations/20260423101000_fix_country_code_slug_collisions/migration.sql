-- Normalize unstable country_code values that cause slug/code identity collisions
-- during Airalo catalog sync.
--
-- Problem patterns observed in production:
-- - country_code = '' (blank)
-- - country_code = 'UNKNOWN'
--
-- The sync now derives missing codes as AIRALO-<slug>. This migration aligns
-- existing rows to that convention and makes blank codes impossible.

WITH candidates AS (
  SELECT
    c.id,
    c.slug,
    UPPER('AIRALO-' || c.slug) AS base_code
  FROM countries c
  WHERE c.country_code IS NULL
     OR BTRIM(c.country_code) = ''
     OR UPPER(c.country_code) = 'UNKNOWN'
),
resolved AS (
  SELECT
    cand.id,
    CASE
      WHEN NOT EXISTS (
        SELECT 1
        FROM countries c2
        WHERE c2.country_code = cand.base_code
          AND c2.id <> cand.id
      ) THEN cand.base_code
      ELSE cand.base_code || '-' || SUBSTRING(REPLACE(cand.id::text, '-', '') FROM 1 FOR 8)
    END AS next_code
  FROM candidates cand
)
UPDATE countries c
SET country_code = r.next_code
FROM resolved r
WHERE c.id = r.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'countries_country_code_not_blank_check'
  ) THEN
    ALTER TABLE countries
      ADD CONSTRAINT countries_country_code_not_blank_check
      CHECK (BTRIM(country_code) <> '');
  END IF;
END
$$;
