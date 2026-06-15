# Drizzle migrations — conventions

## Manual SQL in migrations (not modeled by drizzle snapshots)

Drizzle's generated snapshots (`drizzle/migrations/meta/*.json`) only model what is
declared in `drizzle/schema.ts`. Several things in this project are added as **hand-written
SQL appended to the generated migration files** and are therefore **NOT** reflected in the
snapshots:

- **Foreign keys to the `auth` schema** (e.g. `profiles.id → auth.users(id)`).
- **Row Level Security**: `ENABLE` / `FORCE ROW LEVEL SECURITY`. (Architecture: RLS is a
  deny-by-default backstop — no policies are created, because Drizzle accesses the DB via the
  privileged pooler role and app code is the primary auth gate.)
- **Triggers / functions** (e.g. `handle_new_user()` + `on_auth_user_created`).

Consequences:

- A snapshot may show `"isRLSEnabled": false` even though the live table has RLS forced — this
  is expected. Do not "fix" it by editing the snapshot.
- After `npm run db:generate`, **review the generated SQL** and re-append any manual SQL that a
  schema change would have dropped (or keep manual SQL in its own later migration).
- Treat the live database + the migration `.sql` files (not the snapshots) as the source of
  truth for FK / RLS / triggers.

## Scripts

- `npm run db:generate` — generate a migration from `drizzle/schema.ts`
- `npm run db:migrate` — apply pending migrations (loads `.env.local` via dotenv in `drizzle.config.ts`)
- `npm run db:ping` — verify the DB connection
- `npm run db:check` — verify `profiles` RLS flags + signup trigger exist

## Follow-ups (deferred)

- `profiles.approved_by` has no FK yet — add `→ profiles.id` when the approval flow is finalized.
- `profiles.email` has no unique constraint (currently written once from the signup trigger;
  `auth.users.email` is already unique).
