# Refactor Stage 2b — Proposal Detail Edit Mutations → `features/*`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate the **no-upload** proposal-detail edit mutations onto the new architecture: guarded entity `*.server.ts` fns + Zod, thin route handlers via `toErrorResponse`, and `features/*` (RHF/Zod where there's a form) + `useMutation` hooks that invalidate `proposalQueries.detail`. Covers proposal **settings** (visibility / access password / delete) , **variant** rename / reorder / delete, and version **restore**. The file-upload forms (add-variant / add-version) are **Stage 2c**.

**Architecture:** Write flows `feature UI → useMutation hook → client fetcher (@/shared/api/http) → thin route handler → guarded entity *.server.ts (requireEditor + Zod parse + Drizzle) → toErrorResponse`; on success the hook invalidates `proposalQueries.detail(proposalId)` (and `proposalQueries.lists()` for proposal delete). The guarded mutation fns + their Zod schemas live in `entities/proposal` (the proposal domain); the `features/*` slices own the UI + hooks + client fetchers. Per the user-approved decomposition (Option A), `features/manage-variants` ships **hooks only** in 2b — the legacy `variant-tabs.tsx` (which also renders the 2c `AddVariantForm`) consumes them and is fully relocated in 2c; `proposal-settings` and `version-actions` are standalone and fully replaced now.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), React 19, `@tanstack/react-query` v5, Zod v4, React Hook Form v7, Drizzle, Vitest (node env).

**Source spec:** `docs/superpowers/specs/2026-06-17-fsd-react-query-refactor-design.md`. **Handoff:** `docs/superpowers/HANDOFF.md`. Builds on Stage 0/1/1b/2a (merged): `entities/proposal` (list + detail slices, `proposalQueries.{list,detail}`), `shared/api/{http,to-error-response}`, the client `src/pages/proposal-detail` page composing the legacy edit components.

## Global Constraints

- **Node ≥22** (`package.json` engines; `next build` needs it). Already active on the dev machine (v22.18.0 via nvm) — do not switch Node.
- **FSD layer order:** `shared < entities < features < pages < app`. `entities`/`features` must **not** import `@/legacy`. The reverse — legacy importing `@/features` or `@/entities` — **is** allowed (legacy is the temp holding area being promoted). This stage relies on it: legacy `variant-tabs.tsx` imports `features/manage-variants` hooks; legacy `proposal-editor-preview.tsx` imports the `features/restore-version` button. Entity `index.ts` barrels export only client-safe modules (never `*.server.ts`); feature barrels export only client modules.
- **Guarded reads/writes:** every mutation server fn calls `requireEditor()` first (before any existence check, to avoid enumeration). Security stays server-side.
- **Behavior preservation:** the migrated mutations must keep the existing endpoints' payloads + effects so the still-legacy callers keep working between commits (the routes are thinned first; the legacy components send the same JSON until their feature migration).
- **TDD (red-green) for PURE logic only:** the Zod edit schemas + the `LAST_VARIANT` status mapping. Integration code (server fns hitting Drizzle, route handlers, RHF forms/hooks) has no unit tests in this repo's style (node-env Vitest, no React render harness) — verify via `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, plus the grep gates. State honestly per task.
- **Base UI Button** (`@/shared/ui/button`) defaults to `type="button"`; the password sub-form's submit MUST set `type="submit"`; action buttons stay `type="button"`.
- **One commit per task.** Prettier-format touched/new files before committing. `format:check` stays globally red on not-yet-migrated `src/legacy` + `app/`.
- **Green at every commit.** Thinning a route (Tasks 2–4) keeps the legacy raw-fetch caller working because the Zod schema accepts exactly the legacy payload. A feature migration + its legacy deletion happen in the SAME task (Tasks 5–7).

### Documented behavior divergences (intended)

- Field-validation error codes (`LABEL_REQUIRED`, `INVALID_VISIBILITY`, `INVALID_PASSWORD`, `TITLE_REQUIRED`, `NO_CHANGES`) collapse to `VALIDATION_ERROR` (400) via Zod. Semantic codes are preserved: `LAST_VARIANT` (409), `NOT_FOUND` (404), `FORBIDDEN` (403).
- Mutations surface failures **inline** (feature components) instead of the legacy `setError` raw-fetch strings; success refreshes via React Query invalidation (already true for the 2a-rewired legacy components).
- The access-password minimum stays **4** chars (legacy `minLength={4}` + route `>= 4`).

---

### Task 1: Edit Zod schemas + `LAST_VARIANT` status (TDD)

**Files:**

- Create: `src/entities/proposal/model/edit-schemas.ts`
- Modify: `src/shared/api/to-error-response.ts`
- Test: `tests/entities/proposal/edit-schemas.test.ts`
- Test: `tests/shared/api/to-error-response.test.ts` (add `LAST_VARIANT`)

> Pure, shared validation. The schemas are the single source of truth for the client forms and the server fns. Each "update" schema requires at least one field (mirrors the old `NO_CHANGES` guard) via a `.refine`.

- [ ] **Step 1: Failing schema tests** — `tests/entities/proposal/edit-schemas.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  updateSettingsSchema,
  updateVariantSchema,
  restoreSchema,
} from "@/entities/proposal/model/edit-schemas";

describe("updateSettingsSchema", () => {
  it("accepts a visibility-only change", () => {
    expect(updateSettingsSchema.safeParse({ visibility: "public" }).success).toBe(true);
  });
  it("accepts password: null (clear)", () => {
    expect(updateSettingsSchema.safeParse({ password: null }).success).toBe(true);
  });
  it("rejects a password under 4 chars", () => {
    expect(updateSettingsSchema.safeParse({ password: "abc" }).success).toBe(false);
  });
  it("rejects an invalid visibility", () => {
    expect(updateSettingsSchema.safeParse({ visibility: "secret" }).success).toBe(false);
  });
  it("rejects an empty object (no changes)", () => {
    expect(updateSettingsSchema.safeParse({}).success).toBe(false);
  });
});

describe("updateVariantSchema", () => {
  it("accepts a label-only change", () => {
    expect(updateVariantSchema.safeParse({ label: "A안" }).success).toBe(true);
  });
  it("accepts a sortOrder-only change", () => {
    expect(updateVariantSchema.safeParse({ sortOrder: 2 }).success).toBe(true);
  });
  it("trims and rejects an empty label", () => {
    expect(updateVariantSchema.safeParse({ label: "   " }).success).toBe(false);
  });
  it("rejects a non-integer sortOrder", () => {
    expect(updateVariantSchema.safeParse({ sortOrder: 1.5 }).success).toBe(false);
  });
  it("rejects an empty object", () => {
    expect(updateVariantSchema.safeParse({}).success).toBe(false);
  });
});

describe("restoreSchema", () => {
  it("requires a versionId", () => {
    expect(restoreSchema.safeParse({ versionId: "v1" }).success).toBe(true);
    expect(restoreSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- tests/entities/proposal/edit-schemas.test.ts` (module not found).

- [ ] **Step 3: Implement** — `src/entities/proposal/model/edit-schemas.ts`

```ts
import { z } from "zod";

export const updateSettingsSchema = z
  .object({
    title: z.string().trim().min(1, "제목을 입력하세요").optional(),
    visibility: z.enum(["private", "public"]).optional(),
    // string (≥4) to set/change, or null to clear. Absent = unchanged.
    password: z.union([z.string().min(4, "비밀번호는 4자 이상이어야 합니다"), z.null()]).optional(),
  })
  .refine((v) => v.title !== undefined || v.visibility !== undefined || v.password !== undefined, {
    message: "변경할 항목이 없습니다",
  });
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const updateVariantSchema = z
  .object({
    label: z.string().trim().min(1, "이름을 입력하세요").optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((v) => v.label !== undefined || v.sortOrder !== undefined, {
    message: "변경할 항목이 없습니다",
  });
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const restoreSchema = z.object({
  versionId: z.string().min(1, "versionId가 필요합니다"),
});
export type RestoreInput = z.infer<typeof restoreSchema>;
```

- [ ] **Step 4: Run → PASS** — `npm test -- tests/entities/proposal/edit-schemas.test.ts`.

- [ ] **Step 5: Add `LAST_VARIANT` (TDD)** — append to `tests/shared/api/to-error-response.test.ts` (inside the `describe`):

```ts
it("maps LAST_VARIANT to 409", () => {
  expect(toErrorResponse(new Error("LAST_VARIANT")).status).toBe(409);
});
```

Run → FAIL, then add `LAST_VARIANT: 409,` to `STATUS_BY_CODE` in `src/shared/api/to-error-response.ts`, run → PASS.

- [ ] **Step 6: Format + commit**

```bash
npx prettier --write src/entities/proposal/model/edit-schemas.ts src/shared/api/to-error-response.ts tests/entities/proposal/edit-schemas.test.ts tests/shared/api/to-error-response.test.ts
git add -A
git commit -m "feat: proposal edit Zod schemas + LAST_VARIANT status (Stage 2b)"
```

---

### Task 2: Promote `password.ts` to shared, then `proposal-mutations.server.ts` (settings + delete) + thin `PATCH`/`DELETE /api/proposals/[id]`

**Files:**

- Move: `src/legacy/lib/access/password.ts` → `src/shared/lib/password.ts`
- Move: `tests/access/password.test.ts` → `tests/shared/lib/password.test.ts` (repoint import)
- Modify: `app/p/[publicId]/actions.ts` (repoint `verifyPassword` import)
- Create: `src/entities/proposal/api/proposal-mutations.server.ts`
- Modify: `app/api/proposals/[id]/route.ts` (PATCH + DELETE → thin)

> The entity mutation fn needs `hashPassword`, but an entity importing `@/legacy` is an FSD violation — so promote `password.ts` to `@/shared/lib/password` **first** (Step 1), then write the entity fn importing from shared (Step 2). The legacy `proposal-settings.tsx` keeps calling the same endpoints with the same payloads (`{visibility}` / `{password}` / no-body DELETE) until Task 5 — the Zod schema accepts exactly those.

- [ ] **Step 1: Promote `password.ts` to shared (do this FIRST) + repoint all importers** — `hashPassword`/`verifyPassword` are pure `node:crypto` helpers; both exports move together.

```bash
git mv src/legacy/lib/access/password.ts src/shared/lib/password.ts
git mv tests/access/password.test.ts tests/shared/lib/password.test.ts
# find EVERY importer (scope includes tests/ — the test imports it too):
grep -rn "legacy/lib/access/password" app src tests
```

The grep finds **exactly three** importers — repoint each to `@/shared/lib/password`:

- `tests/shared/lib/password.test.ts` (just moved): change its line-2 import to `@/shared/lib/password`.
- `app/p/[publicId]/actions.ts` (the public-viewer **unlock** server action; imports `verifyPassword`): change to `@/shared/lib/password`.
- `app/api/proposals/[id]/route.ts` (imports `hashPassword`): it's rewritten thin in Step 3 (which drops the import entirely) — but repoint it now so the tree compiles between steps if you commit incrementally.
  > Do NOT add `import "server-only"` to the promoted file — it is imported directly by the node-env Vitest test (`server-only` throws outside a `react-server` bundle and would break the test). It stays a pure shared helper (like `safe-redirect.ts`).
  > Then confirm + run the moved test:

```bash
grep -rn "legacy/lib/access/password" app src tests   # expect NO output
npm test -- tests/shared/lib/password.test.ts          # PASS
```

- [ ] **Step 2: Server fns** — `src/entities/proposal/api/proposal-mutations.server.ts` (imports `hashPassword` from **shared**, not legacy)

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { hashPassword } from "@/shared/lib/password";
import { removeObjects } from "@/shared/storage";
import { updateSettingsSchema } from "../model/edit-schemas";

export async function updateProposalSettings(id: string, input: unknown): Promise<void> {
  await requireEditor();
  const { title, visibility, password } = updateSettingsSchema.parse(input);

  const updates: Partial<typeof proposals.$inferInsert> = {};
  if (title !== undefined) updates.title = title;
  if (visibility !== undefined) updates.visibility = visibility;
  if (password !== undefined)
    updates.accessPasswordHash = password === null ? null : hashPassword(password);
  updates.updatedAt = new Date();

  await db.update(proposals).set(updates).where(eq(proposals.id, id));
}

export async function deleteProposal(id: string): Promise<void> {
  await requireEditor();
  const pages = await db
    .select({ path: proposalPages.storagePath })
    .from(proposalPages)
    .innerJoin(proposalVersions, eq(proposalPages.versionId, proposalVersions.id))
    .innerJoin(proposalVariants, eq(proposalVersions.variantId, proposalVariants.id))
    .where(eq(proposalVariants.proposalId, id));
  await removeObjects([...new Set(pages.map((p) => p.path))]); // best-effort before row delete
  await db.delete(proposals).where(eq(proposals.id, id)); // cascade: variants + versions + pages
}
```

- [ ] **Step 3: Thin the route** — in `app/api/proposals/[id]/route.ts` replace the `PATCH` and `DELETE` handlers (GET stays as the Stage 2a thin wrapper):

```ts
import {
  updateProposalSettings,
  deleteProposal,
} from "@/entities/proposal/api/proposal-mutations.server";
// ...
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await updateProposalSettings(id, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteProposal(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

Remove imports now unused by the route (after this, the route needs only `NextRequest`, the two entity fns, `getProposalDetail`, `toErrorResponse`): drop `db`, `eq`, `proposals`/`proposalVariants`/`proposalVersions`/`proposalPages`, `requireEditor`, `hashPassword`, `removeObjects`, `NextResponse`. Verify with tsc/lint.

> Divergence: success is now `204` (was `{ ok: true }` 200). The legacy `proposal-settings.tsx` only checks `res.ok` (true for 204), so it keeps working. `http()` returns `undefined` on 204.

- [ ] **Step 4: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → PASS.

- [ ] **Step 5: Format + commit**

```bash
npx prettier --write src/entities/proposal/api/proposal-mutations.server.ts src/shared/lib/password.ts "app/api/proposals/[id]/route.ts" "app/p/[publicId]/actions.ts" tests/shared/lib/password.test.ts
git add -A
git commit -m "refactor: proposal settings/delete guarded server fns + thin PATCH/DELETE; promote password to shared (Stage 2b)"
```

---

### Task 3: `variant-mutations.server.ts` (update + delete) + thin `PATCH`/`DELETE /api/proposals/[id]/variants/[variantId]`

**Files:**

- Create: `src/entities/proposal/api/variant-mutations.server.ts`
- Modify: `app/api/proposals/[id]/variants/[variantId]/route.ts`

- [ ] **Step 1: Server fns** — `src/entities/proposal/api/variant-mutations.server.ts`

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { removeObjects } from "@/shared/storage";
import { updateVariantSchema } from "../model/edit-schemas";

export async function updateVariant(id: string, variantId: string, input: unknown): Promise<void> {
  await requireEditor();
  const { label, sortOrder } = updateVariantSchema.parse(input);
  const updates: Partial<typeof proposalVariants.$inferInsert> = {};
  if (label !== undefined) updates.label = label;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  await db
    .update(proposalVariants)
    .set(updates)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, id)));
}

export async function deleteVariant(id: string, variantId: string): Promise<void> {
  await requireEditor();
  const all = await db
    .select({ id: proposalVariants.id })
    .from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id));
  if (all.length <= 1) throw new Error("LAST_VARIANT");
  if (!all.some((v) => v.id === variantId)) throw new Error("NOT_FOUND");

  const pages = await db
    .select({ path: proposalPages.storagePath })
    .from(proposalPages)
    .innerJoin(proposalVersions, eq(proposalPages.versionId, proposalVersions.id))
    .where(eq(proposalVersions.variantId, variantId));
  await removeObjects([...new Set(pages.map((p) => p.path))]); // best-effort before row delete
  await db
    .delete(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, id))); // cascade
}
```

- [ ] **Step 2: Thin the route** — replace `app/api/proposals/[id]/variants/[variantId]/route.ts` entirely:

```ts
import { NextRequest } from "next/server";
import { updateVariant, deleteVariant } from "@/entities/proposal/api/variant-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const { id, variantId } = await params;
    await updateVariant(id, variantId, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const { id, variantId } = await params;
    await deleteVariant(id, variantId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 3: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → PASS. The legacy `variant-tabs.tsx` still calls these endpoints with `{label}`/`{sortOrder}` and no-body DELETE — preserved (rename/reorder/delete keep working; `204` satisfies its `res.ok` checks).

- [ ] **Step 4: Format + commit**

```bash
npx prettier --write src/entities/proposal/api/variant-mutations.server.ts "app/api/proposals/[id]/variants/[variantId]/route.ts"
git add -A
git commit -m "refactor: variant update/delete guarded server fns + thin PATCH/DELETE (Stage 2b)"
```

---

### Task 4: `restore-version.server.ts` + thin `POST /api/proposals/[id]/variants/[variantId]/restore`

**Files:**

- Create: `src/entities/proposal/api/restore-version.server.ts`
- Modify: `app/api/proposals/[id]/variants/[variantId]/restore/route.ts`

- [ ] **Step 1: Server fn** — `src/entities/proposal/api/restore-version.server.ts`

```ts
import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { restoreSchema } from "../model/edit-schemas";

export async function restoreVersion(
  id: string,
  variantId: string,
  input: unknown,
): Promise<{ versionId: string; versionNo: number }> {
  const editor = await requireEditor();
  const { versionId } = restoreSchema.parse(input);

  // Source version must belong to this variant, which must belong to this proposal.
  const src = await db
    .select({ id: proposalVersions.id, versionNo: proposalVersions.versionNo })
    .from(proposalVersions)
    .innerJoin(proposalVariants, eq(proposalVersions.variantId, proposalVariants.id))
    .where(
      and(
        eq(proposalVersions.id, versionId),
        eq(proposalVariants.id, variantId),
        eq(proposalVariants.proposalId, id),
      ),
    )
    .limit(1);
  if (src.length === 0) throw new Error("NOT_FOUND");

  const srcPages = await db
    .select()
    .from(proposalPages)
    .where(eq(proposalPages.versionId, versionId))
    .orderBy(asc(proposalPages.pageOrder));

  const last = await db
    .select({ v: proposalVersions.versionNo })
    .from(proposalVersions)
    .where(eq(proposalVersions.variantId, variantId))
    .orderBy(desc(proposalVersions.versionNo))
    .limit(1);
  const nextNo = (last[0]?.v ?? 0) + 1;

  const newVid = randomUUID();
  await db.insert(proposalVersions).values({
    id: newVid,
    variantId,
    versionNo: nextNo,
    note: `v${src[0].versionNo}에서 복원`,
    createdBy: editor.id,
  });
  if (srcPages.length > 0) {
    await db.insert(proposalPages).values(
      srcPages.map((p) => ({
        id: randomUUID(),
        versionId: newVid,
        pageOrder: p.pageOrder,
        storagePath: p.storagePath,
        width: p.width,
        height: p.height,
      })),
    );
  }
  await db
    .update(proposalVariants)
    .set({ currentVersionId: newVid })
    .where(eq(proposalVariants.id, variantId));
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));

  return { versionId: newVid, versionNo: nextNo };
}
```

- [ ] **Step 2: Thin the route** — replace `app/api/proposals/[id]/variants/[variantId]/restore/route.ts` entirely:

```ts
import { NextRequest } from "next/server";
import { restoreVersion } from "@/entities/proposal/api/restore-version.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const { id, variantId } = await params;
    return Response.json(await restoreVersion(id, variantId, await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

> Returns `{ versionId, versionNo }` (drops the legacy `ok: true` field — the legacy `RestoreButton` ignores the body, only checks `res.ok`).

- [ ] **Step 3: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → PASS. Legacy `RestoreButton` still works.

- [ ] **Step 4: Format + commit**

```bash
npx prettier --write src/entities/proposal/api/restore-version.server.ts "app/api/proposals/[id]/variants/[variantId]/restore/route.ts"
git add -A
git commit -m "refactor: restoreVersion guarded server fn + thin POST restore (Stage 2b)"
```

---

### Task 5: `features/edit-proposal-settings` + wire page + delete legacy settings

**Files:**

- Create: `src/features/edit-proposal-settings/api/settings.ts` (client fetchers)
- Create: `src/features/edit-proposal-settings/api/use-edit-settings.ts` (hooks)
- Create: `src/features/edit-proposal-settings/ui/proposal-settings.tsx` (RHF password form + visibility + delete)
- Create: `src/features/edit-proposal-settings/index.ts`
- Modify: `src/pages/proposal-detail/ui/proposal-detail-page.tsx` (import from feature)
- Delete: `src/legacy/components/proposals/proposal-settings.tsx`

- [ ] **Step 1: Client fetchers** — `src/features/edit-proposal-settings/api/settings.ts`

```ts
import { http } from "@/shared/api/http";
import type { UpdateSettingsInput } from "@/entities/proposal/model/edit-schemas";

export function updateSettings(id: string, input: UpdateSettingsInput): Promise<void> {
  return http<void>(`/api/proposals/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteProposal(id: string): Promise<void> {
  return http<void>(`/api/proposals/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 2: Hooks** — `src/features/edit-proposal-settings/api/use-edit-settings.ts`

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { updateSettings, deleteProposal } from "./settings";
import type { UpdateSettingsInput } from "@/entities/proposal/model/edit-schemas";

export function useUpdateSettings(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => updateSettings(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(id).queryKey });
      queryClient.invalidateQueries({ queryKey: proposalQueries.lists() });
    },
  });
}

export function useDeleteProposal(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteProposal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: proposalQueries.lists() }),
  });
}
```

- [ ] **Step 3: UI** — `src/features/edit-proposal-settings/ui/proposal-settings.tsx`

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useUpdateSettings, useDeleteProposal } from "../api/use-edit-settings";

const passwordSchema = z.object({
  password: z.string().min(4, "비밀번호는 4자 이상이어야 합니다"),
});
type PasswordValues = z.infer<typeof passwordSchema>;

export function ProposalSettings({
  proposalId,
  visibility,
  hasPassword,
}: {
  proposalId: string;
  visibility: string;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const updateSettings = useUpdateSettings(proposalId);
  const deleteProposal = useDeleteProposal(proposalId);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const pending = updateSettings.isPending || deleteProposal.isPending;

  function change(input: Parameters<typeof updateSettings.mutate>[0]) {
    setError(null);
    updateSettings.mutate(input, { onError: () => setError("변경에 실패했습니다.") });
  }

  function onSetPassword({ password }: PasswordValues) {
    change({ password });
    reset();
  }

  function onDelete() {
    if (!confirm("이 시안을 삭제할까요? 모든 버전과 이미지가 사라집니다.")) return;
    setError(null);
    deleteProposal.mutate(undefined, {
      onSuccess: () => router.push("/dashboard/proposals"),
      onError: () => setError("삭제에 실패했습니다."),
    });
  }

  return (
    <div className="border-border space-y-4 rounded-[8px] border p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm">공개 상태:</span>
        <Button
          size="sm"
          variant={visibility === "private" ? "default" : "outline"}
          disabled={pending}
          onClick={() => change({ visibility: "private" })}
        >
          비공개
        </Button>
        <Button
          size="sm"
          variant={visibility === "public" ? "default" : "outline"}
          disabled={pending}
          onClick={() => change({ visibility: "public" })}
        >
          공개
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSetPassword)} className="space-y-2">
        <Label htmlFor="password">
          접근 비밀번호{" "}
          {hasPassword && <span className="text-muted-foreground text-xs">(설정됨)</span>}
        </Label>
        <div className="flex gap-2">
          <Input id="password" type="password" placeholder="4자 이상" {...register("password")} />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            설정/변경
          </Button>
          {hasPassword && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => change({ password: null })}
            >
              비번 해제
            </Button>
          )}
        </div>
        {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
        <p className="text-muted-foreground text-xs">비밀번호는 공개 시안에만 적용됩니다.</p>
      </form>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="border-border border-t pt-4">
        <Button variant="destructive" size="sm" disabled={pending} onClick={onDelete}>
          시안 삭제
        </Button>
      </div>
    </div>
  );
}
```

> `change()`'s param type is inferred from the mutation; passing `{ password: null }` / `{ visibility }` matches `UpdateSettingsInput`. The password sub-form validates ≥4 via `zodResolver`; clear-password and visibility bypass the form (direct mutate).

- [ ] **Step 4: Barrel** — `src/features/edit-proposal-settings/index.ts`

```ts
export { ProposalSettings } from "./ui/proposal-settings";
```

- [ ] **Step 5: Wire the page** — in `src/pages/proposal-detail/ui/proposal-detail-page.tsx` change the import:

```tsx
import { ProposalSettings } from "@/features/edit-proposal-settings";
```

(remove the `@/legacy/components/proposals/proposal-settings` import; the JSX usage is unchanged — same props.)

- [ ] **Step 6: Delete the legacy component + verify no importers**

```bash
git rm src/legacy/components/proposals/proposal-settings.tsx
grep -rn "components/proposals/proposal-settings" app src   # expect NO output
```

- [ ] **Step 7: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → PASS.

- [ ] **Step 8: Manual smoke (if a session is available)** — `npm run dev`; on a proposal detail: toggle 비공개/공개, set/change/clear password (inline error for <4 chars), delete a proposal → navigates to the list and the list reflects it. If no Supabase env, rely on tsc+lint+build and note it.

- [ ] **Step 9: Format + commit**

```bash
npx prettier --write src/features/edit-proposal-settings src/pages/proposal-detail/ui/proposal-detail-page.tsx
git add -A
git commit -m "feat: features/edit-proposal-settings (RHF+Zod) replaces legacy proposal-settings (Stage 2b)"
```

---

### Task 6: `features/restore-version` + wire preview + delete legacy version-actions

**Files:**

- Create: `src/features/restore-version/api/restore.ts` (client fetcher)
- Create: `src/features/restore-version/api/use-restore-version.ts` (hook)
- Create: `src/features/restore-version/ui/restore-button.tsx`
- Create: `src/features/restore-version/index.ts`
- Modify: `src/legacy/components/preview/proposal-editor-preview.tsx` (import RestoreButton from the feature)
- Delete: `src/legacy/components/proposals/version-actions.tsx`

- [ ] **Step 1: Client fetcher** — `src/features/restore-version/api/restore.ts`

```ts
import { http } from "@/shared/api/http";

export function restoreVersion(
  proposalId: string,
  variantId: string,
  versionId: string,
): Promise<{ versionId: string; versionNo: number }> {
  return http(`/api/proposals/${proposalId}/variants/${variantId}/restore`, {
    method: "POST",
    body: JSON.stringify({ versionId }),
  });
}
```

- [ ] **Step 2: Hook** — `src/features/restore-version/api/use-restore-version.ts`

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { restoreVersion } from "./restore";

export function useRestoreVersion(proposalId: string, variantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => restoreVersion(proposalId, variantId, versionId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}
```

- [ ] **Step 3: UI** — `src/features/restore-version/ui/restore-button.tsx`

```tsx
"use client";

import { Button } from "@/shared/ui/button";
import { useRestoreVersion } from "../api/use-restore-version";

export function RestoreButton({
  proposalId,
  variantId,
  versionId,
  isCurrent,
}: {
  proposalId: string;
  variantId: string;
  versionId: string;
  isCurrent: boolean;
}) {
  const restore = useRestoreVersion(proposalId, variantId);
  if (isCurrent) return <span className="text-muted-foreground text-xs">현재 버전</span>;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={restore.isPending}
      onClick={() => restore.mutate(versionId)}
    >
      복원
    </Button>
  );
}
```

- [ ] **Step 4: Barrel** — `src/features/restore-version/index.ts`

```ts
export { RestoreButton } from "./ui/restore-button";
```

- [ ] **Step 5: Wire the preview** — in `src/legacy/components/preview/proposal-editor-preview.tsx` change the import:

```tsx
import { RestoreButton } from "@/features/restore-version";
```

(remove `import { RestoreButton } from "@/legacy/components/proposals/version-actions";`; JSX usage unchanged.)

- [ ] **Step 6: Delete the legacy component + verify**

```bash
git rm src/legacy/components/proposals/version-actions.tsx
grep -rn "components/proposals/version-actions\|version-actions" app src   # expect NO output
```

- [ ] **Step 7: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → PASS.

- [ ] **Step 8: Format + commit**

```bash
npx prettier --write src/features/restore-version src/legacy/components/preview/proposal-editor-preview.tsx
git add -A
git commit -m "feat: features/restore-version replaces legacy version-actions (Stage 2b)"
```

---

### Task 7: `features/manage-variants` hooks + rewire legacy `variant-tabs`

**Files:**

- Create: `src/features/manage-variants/api/variants.ts` (client fetchers)
- Create: `src/features/manage-variants/api/use-manage-variants.ts` (hooks)
- Create: `src/features/manage-variants/index.ts`
- Modify: `src/legacy/components/proposals/variant-tabs.tsx` (raw fetch → hooks)

> Per Option A, `variant-tabs.tsx` stays legacy in 2b (it also renders the 2c `AddVariantForm`); only its rename/reorder/delete raw-fetch is replaced with the feature hooks (legacy → feature import is allowed). Full relocation happens in 2c.

- [ ] **Step 1: Client fetchers** — `src/features/manage-variants/api/variants.ts`

```ts
import { http } from "@/shared/api/http";
import type { UpdateVariantInput } from "@/entities/proposal/model/edit-schemas";

export function updateVariant(
  proposalId: string,
  variantId: string,
  input: UpdateVariantInput,
): Promise<void> {
  return http<void>(`/api/proposals/${proposalId}/variants/${variantId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteVariant(proposalId: string, variantId: string): Promise<void> {
  return http<void>(`/api/proposals/${proposalId}/variants/${variantId}`, { method: "DELETE" });
}
```

- [ ] **Step 2: Hooks** — `src/features/manage-variants/api/use-manage-variants.ts`

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { updateVariant, deleteVariant } from "./variants";
import type { UpdateVariantInput } from "@/entities/proposal/model/edit-schemas";

export function useUpdateVariant(proposalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, input }: { variantId: string; input: UpdateVariantInput }) =>
      updateVariant(proposalId, variantId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}

export function useDeleteVariant(proposalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variantId: string) => deleteVariant(proposalId, variantId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}

// Reorder = swap two variants' sortOrder in ONE mutation so the detail query is
// invalidated exactly once (after BOTH PATCHes land) — avoids the transient
// duplicate-sortOrder flicker that two separate mutateAsync calls would cause.
export function useReorderVariants(proposalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pairs: { variantId: string; sortOrder: number }[]) => {
      await Promise.all(
        pairs.map((p) => updateVariant(proposalId, p.variantId, { sortOrder: p.sortOrder })),
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}
```

- [ ] **Step 3: Barrel** — `src/features/manage-variants/index.ts`

```ts
export { useUpdateVariant, useDeleteVariant, useReorderVariants } from "./api/use-manage-variants";
```

- [ ] **Step 4: Rewire `variant-tabs.tsx`** — in `src/legacy/components/proposals/variant-tabs.tsx`:
  - Add `import { useUpdateVariant, useDeleteVariant, useReorderVariants } from "@/features/manage-variants";`.
  - Remove the local `patch()` helper (the raw `fetch`).
  - Instantiate the hooks: `const updateVariant = useUpdateVariant(proposalId); const deleteVariant = useDeleteVariant(proposalId); const reorderVariants = useReorderVariants(proposalId);` (the file already has `const queryClient = useQueryClient();` + `proposalQueries` from the 2a rewire — both become unused after this change; remove them. verify.).
  - `rename`: replace the `patch(active.id, { label })` + invalidate with:

```tsx
updateVariant.mutate(
  { variantId: active.id, input: { label } },
  {
    onSuccess: () => {
      setError(null);
      setEditing(false);
    },
    onError: () => setError("이름 변경에 실패했습니다."),
  },
);
```

- `move`: replace the two-`patch` `Promise.all` + invalidate with a single `reorderVariants.mutate` (both swaps in one mutation → ONE invalidation after both land, no mid-flight flicker):

```tsx
reorderVariants.mutate(
  [
    { variantId: active.id, sortOrder: idx + dir },
    { variantId: swapWith.id, sortOrder: idx },
  ],
  { onSuccess: () => setError(null), onError: () => setError("순서 변경에 실패했습니다.") },
);
```

- `remove`: replace the `fetch(... DELETE)` + invalidate with:

```tsx
deleteVariant.mutate(active.id, {
  onSuccess: () => {
    const rest = variants.filter((v) => v.id !== active.id)[0];
    if (rest) selectVariant(rest.id);
  },
  onError: () => setError("삭제에 실패했습니다."),
});
```

- Derive the busy flag from the hooks: `const pending = updateVariant.isPending || deleteVariant.isPending || reorderVariants.isPending;` and drop `useTransition`/`start` (now unused). Verify no `start(` references remain.
- Remove imports that become unused after the swap: `useQueryClient` and `proposalQueries` (from the 2a rewire — no longer called directly), and `useTransition`. **Note:** `variant-tabs.tsx` does NOT use `useRouter` (it uses nuqs `useQueryState` for `?variant` — keep that). `lint` (`no-unused-vars`, warn) will flag any leftover; the file must end with zero unused imports.

- [ ] **Step 5: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → PASS. Rename/reorder/delete still work; the `AddVariantForm` (legacy, 2c) is untouched.

- [ ] **Step 6: Format + commit**

```bash
npx prettier --write src/features/manage-variants src/legacy/components/proposals/variant-tabs.tsx
git add -A
git commit -m "feat: features/manage-variants hooks; legacy variant-tabs uses them (Stage 2b)"
```

---

### Task 8: Stage 2b verification gate + handoff update

**Files:** `docs/superpowers/HANDOFF.md` (the rest is verification only)

- [ ] **Step 1: Full green gate** — Node ≥22: `npx tsc --noEmit && npm run lint && npm test && npm run build` → all PASS. Report the test delta (+~13 edit-schemas + 1 LAST_VARIANT + relocated password test) and confirm the route table is unchanged in count (same routes, now thin). Read actual counts from output; don't assert hardcoded absolutes.

- [ ] **Step 2: No-SSR / thin-route check** — the migrated routes delegate to guarded server fns:

```bash
grep -rn "db\.\|drizzle" "app/api/proposals/[id]/route.ts" "app/api/proposals/[id]/variants/[variantId]/route.ts" "app/api/proposals/[id]/variants/[variantId]/restore/route.ts"
```

Expected: NO output (routes are thin — no direct DB access).

- [ ] **Step 3: FSD layering + barrel safety**

```bash
grep -rn "@/legacy" src/entities/proposal src/features/edit-proposal-settings src/features/restore-version src/features/manage-variants   # expect empty
grep -rn "@/widgets/\|@/pages/" src/features                                  # expect empty
grep -rn "\.server\"" src/entities/proposal/index.ts src/features/edit-proposal-settings/index.ts src/features/restore-version/index.ts src/features/manage-variants/index.ts   # expect empty
```

All expected empty.

- [ ] **Step 4: server-only safety** — no `"use client"` module reaches a server module:

```bash
grep -rln "use client" src/features/edit-proposal-settings src/features/restore-version src/features/manage-variants | xargs grep -l "\.server\"\|@/shared/db\|@/shared/storage\"\|@/shared/supabase/service" 2>/dev/null
```

Expected: NO output.

- [ ] **Step 5: legacy password move is clean**

```bash
grep -rn "legacy/lib/access/password" app src tests   # expect empty (moved to @/shared/lib/password)
test ! -f src/legacy/components/proposals/proposal-settings.tsx && test ! -f src/legacy/components/proposals/version-actions.tsx && echo "legacy settings + version-actions deleted OK"
```

- [ ] **Step 6: Update the handoff** — in `docs/superpowers/HANDOFF.md`: add a Stage 2b "Done" entry (settings/variant/restore mutations → guarded entity `*.server.ts` + Zod + thin routes; `features/edit-proposal-settings` + `features/restore-version` replace the legacy components; `features/manage-variants` hooks consumed by the still-legacy `variant-tabs`; `hashPassword`/`verifyPassword` promoted to `@/shared/lib/password`; `LAST_VARIANT` 409 added). Update the test count. Set next = **Stage 2c** (add-variant/add-version upload forms → `features/*`; make the variant/version/pages POST routes thin; relocate `variant-tabs`/`proposal-editor-preview` to features; delete remaining legacy proposal-detail components). Commit:

```bash
npx prettier --write docs/superpowers/HANDOFF.md
git add docs/superpowers/HANDOFF.md
git commit -m "docs: handoff — Stage 2b done (detail edit mutations), next = Stage 2c"
```

---

## Self-Review (completed by author)

- **Spec/handoff coverage:** settings (visibility/password/delete), variant (rename/reorder/delete), restore mutations migrated to guarded entity `*.server.ts` + Zod (Tasks 1–4) behind thin routes; `features/edit-proposal-settings` + `features/restore-version` fully replace their legacy components (Tasks 5–6); `features/manage-variants` hooks consumed by the still-legacy `variant-tabs` per Option A (Task 7); verification + handoff (Task 8). Upload forms (add-variant/add-version) explicitly deferred to 2c.
- **FSD fix folded in:** `hashPassword` cannot stay imported from `@/legacy` by the entity (entities must not import legacy) — Task 2 promotes `password.ts` to `@/shared/lib/password` (FIRST, before the entity fn) and repoints all three real importers: `app/api/proposals/[id]/route.ts` (`hashPassword`, rewritten thin anyway), `app/p/[publicId]/actions.ts` (`verifyPassword`, the public-viewer unlock server action), and the relocated `tests/shared/lib/password.test.ts`.
- **Green-at-every-commit:** Tasks 2–4 thin the routes while the legacy components still call the same endpoints with the same payloads (Zod accepts them; `204`/JSON still satisfies `res.ok`), so edits keep working before their feature migration. Each feature migration + legacy deletion + wiring is one task (5/6/7). The legacy `variant-tabs`/`proposal-editor-preview` remain (upload coupling) but import feature hooks/components (legacy→feature allowed).
- **No-placeholder scan:** all code/commands concrete; edits to existing files show exact snippets; new files complete.
- **Type consistency:** `UpdateSettingsInput`/`UpdateVariantInput`/`RestoreInput` (Task 1) consumed by the entity server fns (Tasks 2–4) and the feature fetchers/hooks (Tasks 5–7); `proposalQueries.detail`/`lists` (2a/1) used by all hooks; `LAST_VARIANT` (Task 1) thrown by `deleteVariant` (Task 3) and mapped by `toErrorResponse`.
- **Known edges / accepted:** success responses become `204` (settings/variant) / JSON (restore) — legacy callers only check `res.ok`; field-validation codes collapse to `VALIDATION_ERROR`; `LAST_VARIANT`/`NOT_FOUND`/`FORBIDDEN` preserved; runtime smoke deferred where no Supabase env.

**Adversarial audit (4 lenses: FSD-password / ordering-green / Next16-RQ-Zod / behavior-security; high+ findings independently refute-verified — 0 confirmed high/blocker):**

- Fixed (the recurring finding, flagged by all 4 lenses): the `verifyPassword` importer was misnamed as `viewer-gate.ts` — it is actually `app/p/[publicId]/actions.ts`. Task 2 now names all three real importers, broadens the repoint grep to `app src tests`, and relocates+repoints the password test as an explicit step.
- Fixed: Task 2 reordered so the `git mv` of `password.ts` happens BEFORE the entity fn, and the entity fn's code block imports from `@/shared/lib/password` (no entity→legacy edge in the canonical paste).
- Fixed: Task 2 Step 5 prettier list now includes the moved test + `app/p/[publicId]/actions.ts`.
- Fixed (low): variant reorder now uses a dedicated `useReorderVariants` hook (both swaps in one mutation → single invalidation) instead of two `mutateAsync` calls (which would invalidate mid-flight → transient duplicate-sortOrder flicker).
- Fixed (low): Task 7's import-cleanup note dropped the bogus `useRouter` mention (variant-tabs uses nuqs, not `useRouter`) and lists the real removables (`useQueryClient`, `proposalQueries`, `useTransition`).
- Declined (low): adding `import "server-only"` to the promoted `password.ts` — it is imported directly by the node-env Vitest test, where `server-only` throws (no `react-server` condition), so it would break the test. The module stays a pure shared helper (consistent with `safe-redirect.ts`); `node:crypto` in a client bundle would fail at build, which is itself a guard.

## Next: Stage 2c

- Migrate `add-variant`/`add-version` upload forms to `features/*` (reusing `shared/storage-client`); make the variant `POST`, version `POST`, and pages `POST` routes thin (`*.server.ts` + Zod + `toErrorResponse`); relocate `variant-tabs` → a `features/manage-variants` component (composing `features/add-variant`) and `proposal-editor-preview` → a feature/widget (composing `features/add-version` + `features/restore-version`); delete the remaining legacy proposal-detail components.
