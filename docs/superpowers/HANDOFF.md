# Refactor Handoff — FSD + React Query + Zod/RHF + No-SSR-Fetch

**Last updated:** 2026-06-18 · **Branch:** `refactor/fsd-react-query` (this branch) · **Live/deployed:** `origin/master` (untouched — do NOT push master).

> This doc is the portable resume point (the equivalent of local machine memory). Read it first when continuing on another machine.

## How to continue (on a new machine)

```bash
git fetch origin
git checkout refactor/fsd-react-query   # tracks origin; has all refactor work
npm install                              # deps were added in Stage 0
npm test                                 # expect all green (115 tests)
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

**Stage 1b — Auth + auxiliary routes** (no-SSR auth slice): `src/pages/home` (`/` redirect, server boundary kept for auth gating); `src/pages/dashboard-home` (client-only dashboard home); `src/pages/{login,signup,pending}` + `src/features/auth` (RHF+Zod forms, `useLogin`/`useSignup`/`useLogout` hooks via `useMutation`). Supabase auth migrated to **route handlers** (`app/api/auth/{login,signup,logout}`) per the user's decision — NOT server actions; `app/(auth)/actions.ts` deleted. `isSafeInternalPath` promoted to `src/shared/lib` (consumed by `LoginForm` for the `returnTo` redirect guard). ESLint `@next/next/no-html-link-for-pages` rule disabled — it misfires on the FSD `src/pages` layer which is not the Pages Router. Added `+3 /api/auth/*` route handlers, `+13` tests (+4 to-error-response, +6 schema, +3 signup-error; safe-redirect test relocated, not added).

**Stage 2a — Proposal detail (client-side read + public images):** `proposalQueries.detail(id)` added to the entity factory; thin guarded `GET /api/proposals/[id]` returns a `ProposalDetail` DTO (`ProposalPage`/`EditorVariant` types centralized in `entities/proposal/model/` with legacy re-export bridges). **Images now public — read-signing dropped:** `publicUrl` helper added to `src/shared/lib/proposals/constants.ts`; the `proposals` storage bucket is set `public: true` (ops step required per environment); `createReadUrl`/`createReadUrls` removed from `src/shared/storage.ts` (upload signing `createUploadUrl` kept). `src/pages/proposal-detail` is now a fully client-side page (`"use client"`) that fetches via `useQuery(proposalQueries.detail(id))` — SSR data-fetch removed; the RSC wrapper (`app/(dashboard)/dashboard/proposals/[id]/page.tsx`) only `await params` and renders the client page. Legacy edit components (`ProposalSettings`, `VariantTabs`, `ProposalEditorPreview`) kept as-is but their mutations now call `queryClient.invalidateQueries({ queryKey: proposalQueries.detail(id).queryKey })` to keep the cache fresh. `loadEditorVariants` deleted from `src/legacy/lib/preview/load-variants.ts`; `loadVariantsForProposal` (public viewer, Stage 4) now uses `publicUrl`. Added `+1` test (`publicUrl`). **Bucket-public ops step:** run `npx tsx --env-file=.env.local scripts/setup-bucket.mts` (it flips the `proposals` bucket to `public: true` via `updateBucket`) on each environment (local, staging, production) before deploying this branch.

**Stage 2b — Detail edit mutations (settings / variants / restore):** Settings (visibility/password/delete), variant (rename/reorder/delete), and version-restore mutations migrated to guarded entity `*.server.ts` + Zod + thin routes. Three new entity server-fn files: `src/entities/proposal/api/proposal-mutations.server.ts` (updateSettings / deleteProposal), `src/entities/proposal/api/variant-mutations.server.ts` (updateVariant / deleteVariant / reorderVariants), `src/entities/proposal/api/restore-version.server.ts`. Thin routes: `PATCH`/`DELETE /api/proposals/[id]`, `PATCH`/`DELETE /api/proposals/[id]/variants/[variantId]`, `POST /api/proposals/[id]/variants/[variantId]/restore` — no direct DB access in route handlers (grep-verified). `hashPassword`/`verifyPassword` promoted from `src/legacy/lib/access/password.ts` to `src/shared/lib/password.ts`; all importers repointed (`app/api/proposals/[id]/route.ts`, `app/p/[publicId]/actions.ts`, `tests/shared/lib/password.test.ts`). `LAST_VARIANT` 409 error added to `to-error-response` (thrown by `deleteVariant` when only one variant remains). Three new features: `src/features/edit-proposal-settings` (RHF+Zod + `useUpdateSettings`/`useDeleteProposal`), `src/features/restore-version` (`useRestoreVersion`), `src/features/manage-variants` (`useUpdateVariant`/`useDeleteVariant`/`useReorderVariants` hooks). Legacy `proposal-settings.tsx` and `version-actions.tsx` deleted; `variant-tabs.tsx` kept (still couples upload forms) but rewired to consume `features/manage-variants` hooks. Entity barrel `index.ts` files export no `*.server` modules (grep-verified). Tests: **115** (+12 from pre-2b 103: edit schemas × ~13, LAST_VARIANT × 1, password test relocated). Build: 26 routes (unchanged count). **Carry-forward (non-transactional mutations):** restore/create/delete are multi-step DB operations without a Drizzle transaction — pre-existing limitation, candidate for a later cleanup stage.

Verification at each stage: `tsc --noEmit` + `lint` + `test` (115) + `build` (26 routes), plus no-SSR / FSD-layering / server-only / no-signing grep gates.

## Next steps

1. ~~**Stage 2b**~~ — **Done** (see above).
2. **Stage 2c** — add-variant/add-version upload forms → `features/*` (reusing `shared/storage-client`); make the variant `POST`, version `POST`, and pages `POST` routes thin (`*.server.ts` + Zod + `toErrorResponse`); relocate `variant-tabs` → a `features/manage-variants` component (composing `features/add-variant`) and `proposal-editor-preview` → a feature/widget (composing `features/add-version` + `features/restore-version`); delete remaining legacy proposal-detail components.
3. Stages 3–6 per the spec: admin users → public viewer+access → realtime (pins/chat) → cleanup + full permission audit + delete `src/legacy`.

## Carry-forwards (fold into the stage that touches them)

- **Stage 2b — legacy add forms:** `src/legacy/components/proposals/{add-variant-form,add-version-form}.tsx` still use raw `fetch` (now importing `@/shared/storage-client`). Migrate to `features/{add-variant,add-version}` using `http` + mutation; reuse the file-meta part of the create schema. (Deferred to Stage 2c.)
- ~~**guarded editor-images GET:**~~ **SUPERSEDED** — the `proposals` bucket is now public; image URLs are served directly via `publicUrl` without signed reads. The public viewer (Stage 4) also uses `publicUrl` instead of signing. No guarded GET route needed.
- ~~**`proposalQueries.detail(id)` doesn't exist yet**~~ — **Done in Stage 2a.** Factory extended; all detail mutations in 2a invalidate the detail query key.
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
