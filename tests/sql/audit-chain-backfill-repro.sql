-- Isolated reproduction of the historical AuditEvent backfill self-join.
-- This uses temporary tables only; it never touches application tables.
BEGIN;

CREATE TEMP TABLE audit_event_legacy_fixture (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  previous_event_hash TEXT,
  event_hash TEXT
);

INSERT INTO audit_event_legacy_fixture (id, created_at) VALUES
  ('event-a', '2026-01-01T00:00:00Z'),
  ('event-b', '2026-01-01T00:00:01Z'),
  ('event-c', '2026-01-01T00:00:02Z');

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at, id)::INTEGER AS sequence,
    lag(id) OVER (ORDER BY created_at, id) AS previous_id
  FROM audit_event_legacy_fixture
),
hashed AS (
  SELECT
    id,
    sequence,
    previous_id,
    md5(id || '|' || sequence::TEXT || '|' || COALESCE(previous_id, '')) AS event_hash
  FROM ranked
)
UPDATE audit_event_legacy_fixture AS a
SET
  sequence = h.sequence,
  previous_event_hash = p.event_hash,
  event_hash = h.event_hash
FROM hashed AS h
LEFT JOIN audit_event_legacy_fixture AS p ON p.id = h.previous_id
WHERE a.id = h.id;

DO $$
DECLARE
  broken_links INTEGER;
BEGIN
  SELECT count(*) INTO broken_links
  FROM audit_event_legacy_fixture
  WHERE sequence > 1 AND previous_event_hash IS NULL;

  IF broken_links <> 2 THEN
    RAISE EXCEPTION 'Expected legacy self-join to reproduce 2 NULL predecessor links, got %', broken_links;
  END IF;
END $$;

CREATE TEMP TABLE audit_event_fixed_fixture (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  previous_event_hash TEXT,
  event_hash TEXT
);

INSERT INTO audit_event_fixed_fixture (id, created_at) VALUES
  ('event-a', '2026-01-01T00:00:00Z'),
  ('event-b', '2026-01-01T00:00:01Z'),
  ('event-c', '2026-01-01T00:00:02Z');

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at, id)::INTEGER AS sequence,
    lag(id) OVER (ORDER BY created_at, id) AS previous_id
  FROM audit_event_fixed_fixture
),
hashed AS (
  SELECT
    id,
    sequence,
    previous_id,
    md5(id || '|' || sequence::TEXT || '|' || COALESCE(previous_id, '')) AS event_hash
  FROM ranked
)
UPDATE audit_event_fixed_fixture AS a
SET
  sequence = h.sequence,
  previous_event_hash = p.event_hash,
  event_hash = h.event_hash
FROM hashed AS h
LEFT JOIN hashed AS p ON p.id = h.previous_id
WHERE a.id = h.id;

DO $$
DECLARE
  broken_links INTEGER;
  linked_rows INTEGER;
BEGIN
  SELECT count(*) INTO broken_links
  FROM audit_event_fixed_fixture AS current_row
  LEFT JOIN audit_event_fixed_fixture AS predecessor
    ON predecessor.sequence = current_row.sequence - 1
  WHERE current_row.sequence > 1
    AND (
      current_row.previous_event_hash IS NULL
      OR current_row.previous_event_hash <> predecessor.event_hash
    );

  SELECT count(*) INTO linked_rows
  FROM audit_event_fixed_fixture
  WHERE previous_event_hash IS NOT NULL;

  IF broken_links <> 0 OR linked_rows <> 2 THEN
    RAISE EXCEPTION 'Corrected hashed-CTE join failed: broken_links %, linked_rows %', broken_links, linked_rows;
  END IF;
END $$;

ROLLBACK;
