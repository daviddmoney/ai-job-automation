# Staging database migration validation

The CI migration workflow validates a clean PostgreSQL deployment and inserts representative users, preferences, jobs, saved jobs and applications. It does **not** replace validation against the actual pre-existing staging database.

Before production deployment:

1. Take and verify a restorable staging database backup.
2. Set the staging-only `DATABASE_URL` in a protected environment; never use the production URL for this test.
3. Run `npx prisma migrate status` and save the output.
4. Run `npx prisma migrate deploy` against staging.
5. Run `npx prisma migrate status` again and confirm every migration is applied.
6. Run `npx prisma generate`, `npm run typecheck`, and `npm run build`.
7. Verify login, user ownership isolation, saved jobs, application tracking, job preferences, translation and job synchronization using separate test accounts.
8. Confirm existing records remain intact and compare representative row counts before and after migration.
9. Do not deploy to production until the staging checks and application smoke tests pass.

The staging database must contain a recent, representative copy of the existing application schema and data. CI's disposable database is only a repeatable migration smoke test.
