# Refactor Stage 6 — Cleanup + Permission Audit + Delete `src/legacy`

> **For agentic workers:** the mechanical cleanup is trivial (one file relocation + dead-code removal + dir delete) and is executed inline by the controller; the value of this stage is the **full permission audit** (workflow) + the **final whole-branch review** (opus). Steps use checkbox (`- [ ]`) syntax.

**Goal:** The final stage of the FSD + React Query refactor. Relocate the last `src/legacy` file, remove dead code, **delete `src/legacy` entirely**, run a comprehensive permission audit (the original Stage-0 goal: every read = one guarded server fn, every mutation guarded), and a final whole-branch review (master..HEAD), then make the deploy/merge decision (master has stayed untouched throughout).

**Tech Stack:** Next.js 16, React 19, React Query v5, Zod, Drizzle, Supabase. Node ≥22.

**Source:** the refactor spec `docs/superpowers/specs/2026-06-17-fsd-react-query-refactor-design.md` (Stage 6) + the handoff. Builds on Stages 0–5 (all merged on `refactor/fsd-react-query`).

## Global Constraints

- **Node ≥22** (active). FSD layer order `shared < entities < features < widgets < pages < app`. Green at every commit (`tsc`/`lint`/`test`/`build`). master untouched until the deploy decision.

### Verified facts (pre-flight)
- `src/legacy` contains exactly ONE file: `src/legacy/components/proposals/variant-tabs.tsx` (FSD-clean — imports only `@/shared/ui`, `@/features/{add-variant,manage-variants}`, nuqs, react). Its ONLY importer is `src/pages/proposal-detail/ui/proposal-detail-page.tsx` (the `proposal-editor-preview` mention is a comment, not an import).
- The entity `PinEvent` (`src/entities/pin/model/types.ts` + the `index.ts` barrel re-export) is DEAD — nothing imports it (the shared provider defines its own generic `PinEvent`).

---

### Task 1: Relocate `variant-tabs` → page-local + remove dead code + delete `src/legacy` (inline)

- [ ] **Step 1: Relocate `variant-tabs` to the proposal-detail page** (its only consumer — page-local UI):
```bash
git mv src/legacy/components/proposals/variant-tabs.tsx src/pages/proposal-detail/ui/variant-tabs.tsx
```
Repoint `src/pages/proposal-detail/ui/proposal-detail-page.tsx`: `import { VariantTabs } from "@/legacy/components/proposals/variant-tabs";` → `import { VariantTabs } from "./variant-tabs";`.

- [ ] **Step 2: Remove the dead entity `PinEvent`** — in `src/entities/pin/model/types.ts` delete the `PinEvent` type block; in `src/entities/pin/index.ts` drop `PinEvent` from the `export type { ... } from "./model/types";` line (keep `PinDTO`, `PinContext`). Guard: `grep -rn "PinEvent" src/entities` → empty.

- [ ] **Step 3: Delete `src/legacy` entirely.**
```bash
git rm -r src/legacy   # only empty dirs remain after Step 1
grep -rn "@/legacy" src app tests   # expect NO output (zero legacy references anywhere)
test ! -d src/legacy && echo "src/legacy gone OK"
```

- [ ] **Step 4: Verify green + commit.** `npx tsc --noEmit && npm run lint && npm test && npm run build` → PASS (139 tests, 27 routes).
```bash
npx prettier --write src/pages/proposal-detail/ui/variant-tabs.tsx "src/pages/proposal-detail/ui/proposal-detail-page.tsx" src/entities/pin/model/types.ts src/entities/pin/index.ts
git add -A
git commit -m "refactor: relocate variant-tabs to proposal-detail page; delete src/legacy; drop dead PinEvent (Stage 6)"
```

---

### Task 2: Full permission audit (workflow) + final whole-branch review

- [ ] **Step 1: Permission audit (workflow).** Fan out over every guarded read/mutation across `entities/*/api/*.server.ts` + `features/*/api/*.server.ts` + the route handlers, and verify: (a) every read server fn has a permission guard (`requireEditor`/`requireAdmin`/`resolveViewerGate`/`getProfile`); (b) every mutation server fn is guarded; (c) NO route handler touches `db`/`drizzle` directly (all thin → server fn); (d) entity/feature barrels export no `*.server`; (e) `server-only` on every `*.server.ts`. Triage findings; fix any real gaps as a follow-up task.

- [ ] **Step 2: No-SSR / FSD structural gates (whole repo).**
```bash
grep -rn "@/legacy" src app tests                 # empty (legacy gone)
grep -rln "db\.\|drizzle" app/api                   # NONE — every route handler is thin
grep -rln "\.server\"" src/*/*/index.ts             # NONE — no barrel exports a server module
```

- [ ] **Step 3: Final whole-branch review (opus).** `scripts/review-package $(git merge-base master HEAD) HEAD` → opus reviewer over the ENTIRE refactor (the diff is large; focus on the security boundary, FSD layering, and any cross-stage inconsistency). Fix Critical/Important before the merge decision.

- [ ] **Step 4: Handoff — refactor COMPLETE.** Update `docs/superpowers/HANDOFF.md`: all stages done, `src/legacy` gone, permission audit result, final review verdict. List the remaining carry-forwards (non-transactional multi-step mutations; the bucket-public ops step per environment; runtime smoke tests). Present the deploy/merge decision to the user (master untouched throughout).

---

## Carry-forwards (still open at refactor end)
- **Non-transactional multi-step mutations** (restore/create variant+version+pages, delete) — no Drizzle transaction; pre-existing; candidate for a hardening pass.
- **Bucket-public ops step** — `npx tsx --env-file=.env.local scripts/setup-bucket.mts` (flips the `proposals` bucket to public) must run per environment before deploy.
- **Runtime smoke** — auth, proposals CRUD, upload, public viewer (access/variants), realtime (chat/pins/cursors/presence) — deferred where no local Supabase env; run against staging before the deploy decision.
- **Rotate Supabase secrets** (DB password + secret key were exposed in chat earlier) — do before/at deploy.
