BEGIN;

-- Check counts before
DO $$
BEGIN
  RAISE NOTICE 'Pointers before: %', (SELECT COUNT(*) FROM public.job_pointers);
END $$;

-- 1. Create a mapping table to handle collisions
CREATE TEMP TABLE pointer_migration_map AS
WITH recalculated AS (
  SELECT
    id,
    fingerprint as old_fingerprint,
    encode(digest(
      lower(regexp_replace(COALESCE(company_name, 'Unknown'), '[^a-z0-9]', '', 'g')) || '|' ||
      lower(regexp_replace(COALESCE(title, 'Unknown'), '[^a-z0-9]', '', 'g')) || '|' ||
      lower(regexp_replace(COALESCE(location_name, 'Remote'), '[^a-z0-9]', '', 'g')),
      'sha256'
    ), 'hex') as new_fingerprint
  FROM public.job_pointers
),
ranked AS (
  SELECT
    id,
    old_fingerprint,
    new_fingerprint,
    row_number() OVER (PARTITION BY new_fingerprint ORDER BY id) as rank
  FROM recalculated
)
SELECT id, old_fingerprint, new_fingerprint, rank
FROM ranked;

-- 2. Identify the 'Master' ID for each new fingerprint
CREATE TEMP TABLE master_pointers AS
SELECT new_fingerprint, id as master_id
FROM pointer_migration_map
WHERE rank = 1;

-- 3. Cascade updates for orphaned documents and canonical jobs
UPDATE public.raw_job_documents doc
SET job_pointer_id = m.master_id
FROM pointer_migration_map map
JOIN master_pointers m ON m.new_fingerprint = map.new_fingerprint
WHERE doc.job_pointer_id = map.id AND map.rank > 1;

UPDATE public.canonical_jobs c
SET job_pointer_id = m.master_id
FROM pointer_migration_map map
JOIN master_pointers m ON m.new_fingerprint = map.new_fingerprint
WHERE c.job_pointer_id = map.id AND map.rank > 1;

-- 4. Delete orphaned pointers
DELETE FROM public.job_pointers
WHERE id IN (SELECT id FROM pointer_migration_map WHERE rank > 1);

-- 5. Update fingerprints for survivors
-- Disable constraints temporarily to avoid clashing during transition
ALTER TABLE public.job_pointers DROP CONSTRAINT IF EXISTS job_pointers_fingerprint_key;
ALTER TABLE public.job_pointers DROP CONSTRAINT IF EXISTS unique_fingerprint;

UPDATE public.job_pointers p
SET fingerprint = m.new_fingerprint
FROM pointer_migration_map m
WHERE p.id = m.id AND m.rank = 1;

-- 6. Restore constraints
ALTER TABLE public.job_pointers ADD CONSTRAINT unique_fingerprint UNIQUE (fingerprint);

-- Check counts after
DO $$
BEGIN
  RAISE NOTICE 'Pointers after: %', (SELECT COUNT(*) FROM public.job_pointers);
END $$;

COMMIT;
