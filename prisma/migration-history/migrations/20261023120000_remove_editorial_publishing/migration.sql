-- Apply only after the application removal is deployed and old instances/jobs have drained.
-- Privately back up legacy publishing/audit rows before applying this contract migration.
BEGIN;

DROP TABLE "publishing_state";
DROP TABLE "pricing_audits";

COMMIT;
