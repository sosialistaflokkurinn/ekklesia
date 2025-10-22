# Elections Schema Migration Dry-Run Checklist (Dev Snapshot)

## Pre-Flight
- [ ] Confirm latest dev snapshot name (Cloud SQL) and restore timestamp recorded in ops log.
- [ ] Verify Cloud SQL Auth Proxy credentials (service account key / gcloud login) on operator workstation.
- [ ] Export current catalog for reference:
  ```bash
  psql "$DEV_CONN_URI" -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('public','elections') ORDER BY table_schema, table_name;"
  psql "$DEV_CONN_URI" -c "SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname IN ('public','elections') ORDER BY schemaname, tablename;"
  psql "$DEV_CONN_URI" -c "SELECT conname, contype, conrelid::regclass FROM pg_constraint WHERE connamespace IN ('public'::regnamespace, 'elections'::regnamespace) ORDER BY conrelid::regclass::text, conname;"
  ```
- [ ] Save output to `archive/ops/testing-logs/elections-schema-dryrun-$(date +%Y%m%d).log`.

## Execution
- [ ] Run migration SQL locally:
  ```bash
  psql "$DEV_CONN_URI" -f events/migrations/004_move_to_elections_schema.sql
  ```
- [ ] Confirm zero errors and transaction committed.

## Post-Run Verification
- [ ] Re-run catalog queries and diff against pre-flight output.
- [ ] Validate row counts:
  ```bash
  psql "$DEV_CONN_URI" -c "SELECT COUNT(*) FROM elections.election;"
  psql "$DEV_CONN_URI" -c "SELECT COUNT(*) FROM elections.voting_tokens;"
  ```
- [ ] Smoke test admin API against dev snapshot to ensure schema-qualified queries succeed.
- [ ] Update ops log with results, timestamp, and next steps.

## Contingency
- [ ] If migration fails, restore snapshot and capture error output for troubleshooting.
- [ ] File incident note in `docs/status/DATABASE_SECURITY_HARDENING.md` appendix if rollback exercised.
