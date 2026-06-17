# Refactor Handoff — FSD + React Query + Zod/RHF + No-SSR-Fetch

**Last updated:** 2026-06-17 · **Branch:** `refactor/fsd-react-query` (this branch) · **Live/deployed:** `origin/master` (untouched — do NOT push master).

> This doc is the portable resume point (the equivalent of local machine memory). Read it first when continuing on another machine.

## How to continue (on a new machine)

```bash
git fetch origin
git checkout refactor/fsd-react-query   # tracks origin; has all refactor work
npm install                              # deps were added in Stage 0
npm test                                 # expect all green (89 tests)
npm run build                            # expect PASS
```

`master` locally must stay equal to `origin/master` (the live service). Never merge/push the refactor branch into `master` until the whole migration is verified and you intend to deploy. Each stage so far was developed on its own branch and the work now lives entirely on `refactor/fsd-react-query`.

## Why this branch exists (the goal)

Refactor the app per these requirements: **React Query** for all reads; **Zod + React Hook Form** for all forms; **each read = one server function with a permission guard** (audit for missing guards); **no SSR data-fetching** (client fetch via React Query, but permission checks + auth redirect stay server-side); **Feature-Sliced Design** layout; readability/Prettier.

- Full design spec: `docs/superpowers/specs/2026-06-17-fsd-react-query-refactor-design.md` (5-lens adversarially audited).
- Per-stage plans: `docs/superpowers/plans/2026-06-17-refactor-stage0-foundation.md`, `…-stage1-proposals.md` (each adversarially audited before execution).

## Architecture (target)

```
app/            Next routing (thin). page.tsx = 1-line re-export from @/pages/*. api/* = thin route handlers.
pages/README.md MUST stay empty — see "Next 16 gotcha" below.
proxy.ts        middleware: auth redirect + same-origin CSRF guard for /api mutations.
drizzle/        schema (server) → @drizzle/* alias.
src/            @ → ./src
  app/          providers (QueryProvider) + styles (globals.css). NO route files allowed here.
  pages/        FSD page compositions (client). proposals-list/, proposal-new/.
  features/     user actions (mutations + RHF/Zod forms). create-proposal/.
  entities/     domain model + reads. proposal/ (queryOptions factory + guarded *.server.ts + model schema).
  shared/       api/(http, query-client, to-error-response, same-origin) · ui · lib · auth · supabase · db · storage · storage-client · realtime · config.
  legacy/       TEMP holding area for not-yet-migrated code. Promoted slice-by-slice; deleted in the final stage.
```

**Key patterns:**
- Read: client page `useQuery(xQueries.list())` → client fetcher (`@/shared/api/http`) → `GET /api/x` (thin) → `getX()` `*.server.ts` (`requireEditor()` guard + Drizzle) → errors via `toErrorResponse`.
- Write: RHF+Zod form → `useMutation` → `POST /api/x` (thin) → `createX()` `*.server.ts` (guard + `schema.parse` + DB) → invalidate query key.
- Zod schema shared by client form + server fn lives in `entities/x/model/` (lower layer, so both can import it).
- Entity `index.ts` barrels export ONLY client-safe modules — never `*.server.ts`.
- Security stays server-side: route-handler guards + `(dashboard)/layout.tsx` redirect + `proxy.ts`. `server-only` on service-role/db/storage/guards modules.

## Done so far

**Stage 0 — Foundation** (no behavior change): `src/{shared,app,legacy}` skeleton, `@→src` + `@drizzle/*` aliases, deps (react-query, zod, rhf, @hookform/resolvers, server-only, prettier), QueryProvider in root layout (NuqsAdapter preserved), `shared/api/{http+HttpError, to-error-response, query-client, same-origin}` (all unit-tested), shared modules promoted from legacy (ui, lib/utils, auth roles+guards, supabase, db, realtime channel/identity/coords, storage, fonts).

**Stage 1 — Proposals core** (read + create vertical slice): `entities/proposal` (queryOptions factory + client fetchers + guarded `getProposals`/`createProposal` `*.server.ts` + `model/create-schema.ts`), thin `GET`/`POST /api/proposals` via `toErrorResponse`, `features/create-proposal` (RHF+Zod + `useMutation` + client upload orchestration), `src/shared/storage-client.ts` (moved from legacy), `src/pages/{proposals-list,proposal-new}` client pages, root routes are 1-line re-exports, CSRF same-origin guard in `proxy.ts`, `server-only` on `service.ts`.

Verification at each stage: `tsc --noEmit` + `lint` + `test` (89) + `build` (23 routes), plus no-SSR / FSD-layering / server-only grep gates.

## Next steps

1. **Stage 1b** — migrate the remaining auxiliary routes: `app/page.tsx` (`/` redirect, keep server boundary) → `src/pages/home`; `dashboard/page.tsx` → `src/pages/dashboard-home`; the `(auth)` login/signup + pending pages → `src/pages/*` + `features/auth` (RHF+Zod forms; **keep the Supabase auth as server actions**, just wrap the UI). Write the plan first (`docs/superpowers/plans/`), audit it, then execute.
2. **Stage 2** — variants/versions + proposal-detail (currently still legacy RSC). Carry-forwards below.
3. Stages 3–6 per the spec: admin users → public viewer+access → realtime (pins/chat) → cleanup + full permission audit + delete `src/legacy`.

## Carry-forwards (fold into the stage that touches them)

- **Stage 2 — guarded editor-images GET:** the proposal-detail page reads variant pages + signed image URLs server-side with NO guarded API route yet. Add a `requireEditor`-guarded GET before moving it client-side (security blocker from the audit). Same pattern for the public viewer (Stage 4) and chat (Stage 5).
- **Stage 2 — legacy add forms:** `src/legacy/components/proposals/{add-variant-form,add-version-form}.tsx` still use raw `fetch` (now importing `@/shared/storage-client`). Migrate to `features/{add-variant,add-version}` using `http` + mutation; reuse the file-meta part of the create schema.
- **`proposalQueries.detail(id)`** doesn't exist yet — add it to the factory when variant/version mutations need detail invalidation.
- **Client `Proposal` DTO:** entity types rows as the Drizzle row (`createdAt`/`updatedAt: Date`), but over HTTP they're ISO strings. Introduce a DTO when a stage renders/parses a timestamp.
- **`http()` drops Zod `issues[]`** from 4xx bodies (keeps only the code). Surface server validation messages if a form needs them.
- **`@tanstack/react-query-devtools`** is in `dependencies` (dev-stripped by the package — fine).
- Empty leftover dirs in `src/legacy` (lib/auth, lib/fonts, components/ui) are removed in the final cleanup stage.

## Gotchas / decisions

- **Next 16 `pages/` collision (important):** the FSD `src/pages` layer is detected by Next 16 as the Pages Router (`findDir` checks root then `src/`), conflicting with root `app/`. Fix in place: an empty root `pages/` (README only) so Next uses root `app/`+`pages/` and ignores `src/pages` as a router. Never put route files in root `pages/`.
- **No-SSR means data fetch only** — auth gating/redirect and permission checks intentionally stay server-side.
- **CSRF:** `proxy.ts` rejects cross-origin `/api` POST/PUT/PATCH/DELETE (Origin-less callers get 403 too — fine, only the browser app calls these).
- **Prettier:** format per file as it migrates; global `format:check` is intentionally red on not-yet-migrated `src/legacy` + `app/` code.
- Documented intended behavior divergences in Stage 1: validation errors → `VALIDATION_ERROR` (400); 0-byte files rejected; malformed-body-from-non-editor → 500; `ID_GENERATION_FAILED` → `INTERNAL_ERROR`.
