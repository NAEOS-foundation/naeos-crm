DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "AuditEvent"
    WHERE "eventHash" IS NULL OR length("eventHash") NOT IN (32, 64)
       OR "eventHash" !~ '^[0-9a-f]+$'
  ) THEN
    RAISE EXCEPTION 'AuditEvent contains an unsupported or missing digest; refusing hash metadata backfill';
  END IF;
END $$;

ALTER TABLE "AuditEvent"
  ADD COLUMN "hashAlgorithm" TEXT,
  ADD COLUMN "hashVersion" INTEGER;

-- Preserve historical digest contracts; existing hashes are not recomputed.
UPDATE "AuditEvent"
SET
  "hashAlgorithm" = CASE length("eventHash") WHEN 32 THEN 'MD5' WHEN 64 THEN 'SHA256' END,
  "hashVersion" = CASE length("eventHash") WHEN 32 THEN 0 WHEN 64 THEN 1 END;

ALTER TABLE "AuditEvent"
  ALTER COLUMN "hashAlgorithm" SET NOT NULL,
  ALTER COLUMN "hashVersion" SET NOT NULL,
  ALTER COLUMN "hashAlgorithm" SET DEFAULT 'SHA256',
  ALTER COLUMN "hashVersion" SET DEFAULT 2,
  ADD CONSTRAINT "AuditEvent_hash_contract_check"
    CHECK (
      ("hashAlgorithm" = 'MD5' AND "hashVersion" = 0)
      OR ("hashAlgorithm" = 'SHA256' AND "hashVersion" IN (1, 2))
    );
