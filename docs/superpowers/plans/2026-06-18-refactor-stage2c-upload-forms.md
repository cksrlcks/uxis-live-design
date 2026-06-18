# Refactor Stage 2c — Variant/Version Upload Forms → `features/*` + thin POST routes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate the last raw-`fetch` surface of the proposal detail page — the **add-variant** and **add-version** image-upload forms — onto the new architecture: guarded entity `*.server.ts` fns + Zod, thin POST route handlers via `toErrorResponse`, and `features/{add-variant,add-version}` (upload orchestration + `useMutation`) that invalidate `proposalQueries.detail`. Thins the three remaining inline POST routes (create variant, create version, confirm pages).

**Architecture:** Upload flow mirrors the merged `features/create-proposal`: `feature form → measureAll(files) → POST create (returns {…, uploads[]}) → uploadAll(uploads, measured) → POST …/pages confirm → invalidate proposalQueries.detail`. The guarded server fns (`createVariant`, `createVersion`, `confirmPages`) + their Zod schemas live in `entities/proposal`; the `features/*` slices own the form UI + client orchestration + hooks. The legacy `variant-tabs.tsx` and `proposal-editor-preview.tsx` are **rewired** to render the new feature forms (legacy → feature import is allowed) and the two legacy upload forms are deleted.

**Scope decision (user-approved — Option A):** This stage migrates only the **write/upload path**. The read-only preview components (`proposal-preview`, `fullscreen-slides`, `canvas-view`, `use-prefetch-images`) and the editor/viewer composition shells (`variant-tabs`, `proposal-editor-preview`) stay in `src/legacy` because they are tightly coupled to the **pins** subsystem (`pin-layer` → `use-pins` → `pins/types`) and the **public viewer** (Stage 4). Fully relocating them would drag Stage 4 + Stage 5 forward. Their relocation is deferred to Stage 4 (public viewer), where the shared preview + pins are placed properly.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), React 19, `@tanstack/react-query` v5, Zod v4, React Hook Form v7, Supabase Storage (signed UPLOAD URLs kept), Vitest (node env).

**Source spec:** `docs/superpowers/specs/2026-06-17-fsd-react-query-refactor-design.md`. **Handoff:** `docs/superpowers/HANDOFF.md`. Builds on Stage 0/1/1b/2a/2b (merged): `features/create-proposal` (the upload pattern to mirror), `shared/storage-client` (`measureAll`/`uploadAll`), `entities/proposal` (model + `proposalQueries.detail`), `shared/api/{http,to-error-response}`, the `fileMetaSchema` in `entities/proposal/model/create-schema.ts`.

## Global Constraints

- **Node ≥22** (`package.json` engines; `next build` needs it). Already active on the dev machine (v22.18.0 via nvm) — do not switch Node.
- **FSD layer order:** `shared < entities < features < pages < app`. `entities`/`features` must **not** import `@/legacy`. The reverse — legacy importing `@/features` — **is** allowed (legacy `variant-tabs.tsx`/`proposal-editor-preview.tsx` render the new feature forms). Entity/feature barrels export only client-safe modules (never `*.server.ts`).
- **Guarded writes:** every server fn calls `requireEditor()` first. Signed UPLOAD URLs (`createUploadUrl`) stay server-side; image READS are public (`publicUrl`, from Stage 2a) — no read-signing here.
- **Behavior preservation:** the migrated routes keep the existing payloads + response shapes (`{variantId,versionId,slug,label,uploads}`, `{versionId,versionNo,uploads}`, pages-confirm) so the upload orchestration works unchanged. The page-confirm route still verifies every uploaded object exists in storage before inserting rows.
- **TDD (red-green) for PURE logic only:** the upload Zod schemas + the `OBJECT_MISSING` status mapping. Integration code (server fns, route handlers, RHF forms hitting storage) has no unit tests in this repo's style — verify via `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, plus grep gates. State honestly per task.
- **Base UI Button** defaults `type="button"`; each upload form's submit MUST be `type="submit"`.
- **One commit per task.** Prettier-format touched/new files before committing. `format:check` stays globally red on not-yet-migrated `src/legacy` + `app/`.
- **Green at every commit.** Tasks 2–4 thin the routes while the legacy upload forms still POST the same payloads (Zod accepts them; response shapes unchanged), so add-variant/add-version keep working until their feature migration (Tasks 5–6).

### Documented behavior divergences (intended)

- File-validation codes (`NO_FILES`, `INVALID_TYPE`, `FILE_TOO_LARGE`, `NO_PAGES`) collapse to `VALIDATION_ERROR` (400) via the Zod schemas. Semantic codes preserved: `NOT_FOUND` (404), `OBJECT_MISSING` (400), `FORBIDDEN` (403). `OBJECT_MISSING`'s response no longer includes the offending `path` (the code-based `toErrorResponse` contract); the client orchestration never read it.
- `0`-byte files are rejected by `fileMetaSchema` (`.int().positive()`) — same tightening already applied to create-proposal in Stage 1 (the old route used `> MAX` only).
- Pages-confirm success becomes `204` (was `{ ok: true }`); the client orchestration only checks `res.ok`.

---

### Task 1: Upload Zod schemas + `OBJECT_MISSING` status (TDD)

**Files:**

- Create: `src/entities/proposal/model/upload-schemas.ts`
- Modify: `src/shared/api/to-error-response.ts`
- Test: `tests/entities/proposal/upload-schemas.test.ts`
- Test: `tests/shared/api/to-error-response.test.ts` (add `OBJECT_MISSING`)

> Reuses `fileMetaSchema` (content-type ∈ ALLOWED + size int/positive/≤MAX) from `create-schema.ts`. Three schemas for the three POST bodies.

- [ ] **Step 1: Failing schema tests** — `tests/entities/proposal/upload-schemas.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  createVariantSchema,
  createVersionSchema,
  confirmPagesSchema,
} from "@/entities/proposal/model/upload-schemas";

const okFile = { contentType: "image/png", size: 1000 };
const okPage = { pageId: "p1", pageOrder: 0, path: "a/b/p1.png", width: 800, height: 600 };

describe("createVariantSchema", () => {
  it("accepts ≥1 valid file", () => {
    expect(createVariantSchema.safeParse({ files: [okFile] }).success).toBe(true);
  });
  it("rejects empty files", () => {
    expect(createVariantSchema.safeParse({ files: [] }).success).toBe(false);
  });
  it("rejects a disallowed content type", () => {
    expect(
      createVariantSchema.safeParse({ files: [{ contentType: "image/gif", size: 10 }] }).success,
    ).toBe(false);
  });
});

describe("createVersionSchema", () => {
  it("accepts files with an optional note", () => {
    expect(createVersionSchema.safeParse({ files: [okFile] }).success).toBe(true);
    expect(createVersionSchema.safeParse({ note: "메모", files: [okFile] }).success).toBe(true);
  });
  it("rejects empty files", () => {
    expect(createVersionSchema.safeParse({ note: "메모", files: [] }).success).toBe(false);
  });
});

describe("confirmPagesSchema", () => {
  it("accepts ≥1 well-formed page", () => {
    expect(confirmPagesSchema.safeParse({ pages: [okPage] }).success).toBe(true);
  });
  it("rejects empty pages", () => {
    expect(confirmPagesSchema.safeParse({ pages: [] }).success).toBe(false);
  });
  it("rejects a page with a non-integer pageOrder", () => {
    expect(confirmPagesSchema.safeParse({ pages: [{ ...okPage, pageOrder: 1.5 }] }).success).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- tests/entities/proposal/upload-schemas.test.ts` (module not found).

- [ ] **Step 3: Implement** — `src/entities/proposal/model/upload-schemas.ts`

```ts
import { z } from "zod";
import { fileMetaSchema } from "./create-schema";

export const createVariantSchema = z.object({
  files: z.array(fileMetaSchema).min(1, "이미지를 1개 이상 선택하세요"),
});
export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const createVersionSchema = z.object({
  note: z.string().trim().optional(),
  files: z.array(fileMetaSchema).min(1, "이미지를 1개 이상 선택하세요"),
});
export type CreateVersionInput = z.infer<typeof createVersionSchema>;

const pageInputSchema = z.object({
  pageId: z.string().min(1),
  pageOrder: z.number().int().nonnegative(),
  path: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const confirmPagesSchema = z.object({
  pages: z.array(pageInputSchema).min(1, "페이지가 없습니다"),
});
export type ConfirmPagesInput = z.infer<typeof confirmPagesSchema>;
```

- [ ] **Step 4: Run → PASS** — `npm test -- tests/entities/proposal/upload-schemas.test.ts`.

- [ ] **Step 5: Add `OBJECT_MISSING` (TDD)** — append to `tests/shared/api/to-error-response.test.ts` (inside the `describe`):

```ts
it("maps OBJECT_MISSING to 400", () => {
  expect(toErrorResponse(new Error("OBJECT_MISSING")).status).toBe(400);
});
```

Run → FAIL, then add `OBJECT_MISSING: 400,` to `STATUS_BY_CODE` in `src/shared/api/to-error-response.ts`, run → PASS.

- [ ] **Step 6: Format + commit**

```bash
npx prettier --write src/entities/proposal/model/upload-schemas.ts src/shared/api/to-error-response.ts tests/entities/proposal/upload-schemas.test.ts tests/shared/api/to-error-response.test.ts
git add -A
git commit -m "feat: variant/version/pages upload Zod schemas + OBJECT_MISSING status (Stage 2c)"
```

---

### Task 2: `createVariant` server fn + thin `POST /api/proposals/[id]/variants`

**Files:**

- Create: `src/entities/proposal/api/create-variant.server.ts`
- Modify: `app/api/proposals/[id]/variants/route.ts`

- [ ] **Step 1: Server fn** — `src/entities/proposal/api/create-variant.server.ts`

```ts
import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { extForContentType, pagePath } from "@/shared/lib/proposals/constants";
import { nextVariantSlug, defaultVariantLabel } from "@/shared/lib/proposals/variant-slug";
import { createUploadUrl } from "@/shared/storage";
import { createVariantSchema } from "../model/upload-schemas";

export async function createVariant(id: string, input: unknown) {
  const editor = await requireEditor();
  const { files } = createVariantSchema.parse(input);

  const proposal = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(eq(proposals.id, id))
    .limit(1);
  if (proposal.length === 0) throw new Error("NOT_FOUND");

  const existing = await db
    .select({ slug: proposalVariants.slug })
    .from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id));
  const slug = nextVariantSlug(existing.map((e) => e.slug));
  const label = defaultVariantLabel(existing.length);

  const variantId = randomUUID();
  const versionId = randomUUID();
  await db.insert(proposalVariants).values({
    id: variantId,
    proposalId: id,
    label,
    slug,
    sortOrder: existing.length,
    createdBy: editor.id,
  });
  await db
    .insert(proposalVersions)
    .values({ id: versionId, variantId, versionNo: 1, createdBy: editor.id });

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(files[i].contentType)!;
    const pageId = randomUUID();
    const path = pagePath(id, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({ pageId, path, token: signed.token, signedUrl: signed.signedUrl, pageOrder: i });
  }

  return { variantId, versionId, slug, label, uploads };
}
```

> `requireEditor()` is called BEFORE the proposal-existence check (consistent with the other Stage 2b fns — no enumeration). `extForContentType` is non-null because `fileMetaSchema` already restricted `contentType` to `ALLOWED_IMAGE_TYPES`.

- [ ] **Step 2: Thin the route** — replace `app/api/proposals/[id]/variants/route.ts` entirely:

```ts
import { NextRequest } from "next/server";
import { createVariant } from "@/entities/proposal/api/create-variant.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await createVariant(id, await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 3: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → PASS. The legacy `add-variant-form.tsx` still POSTs `{files:[{contentType,size}]}` and reads `{variantId,versionId,uploads}` — preserved.

- [ ] **Step 4: Format + commit**

```bash
npx prettier --write src/entities/proposal/api/create-variant.server.ts "app/api/proposals/[id]/variants/route.ts"
git add -A
git commit -m "refactor: createVariant guarded server fn + thin POST variants (Stage 2c)"
```

---

### Task 3: `createVersion` server fn + thin `POST /api/proposals/[id]/variants/[variantId]/versions`

**Files:**

- Create: `src/entities/proposal/api/create-version.server.ts`
- Modify: `app/api/proposals/[id]/variants/[variantId]/versions/route.ts`

- [ ] **Step 1: Server fn** — `src/entities/proposal/api/create-version.server.ts`

```ts
import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalVariants, proposalVersions } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { extForContentType, pagePath } from "@/shared/lib/proposals/constants";
import { createUploadUrl } from "@/shared/storage";
import { createVersionSchema } from "../model/upload-schemas";

export async function createVersion(id: string, variantId: string, input: unknown) {
  const editor = await requireEditor();
  const { note, files } = createVersionSchema.parse(input);

  const variant = await db
    .select({ id: proposalVariants.id })
    .from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, id)))
    .limit(1);
  if (variant.length === 0) throw new Error("NOT_FOUND");

  const last = await db
    .select({ v: proposalVersions.versionNo })
    .from(proposalVersions)
    .where(eq(proposalVersions.variantId, variantId))
    .orderBy(desc(proposalVersions.versionNo))
    .limit(1);
  const nextNo = (last[0]?.v ?? 0) + 1;

  const versionId = randomUUID();
  await db.insert(proposalVersions).values({
    id: versionId,
    variantId,
    versionNo: nextNo,
    note: note && note.length > 0 ? note : null,
    createdBy: editor.id,
  });

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(files[i].contentType)!;
    const pageId = randomUUID();
    const path = pagePath(id, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({ pageId, path, token: signed.token, signedUrl: signed.signedUrl, pageOrder: i });
  }

  return { versionId, versionNo: nextNo, uploads };
}
```

> `note` is coerced to `null` when absent/empty (matches the legacy `body.note ? trim : null`).

- [ ] **Step 2: Thin the route** — replace `app/api/proposals/[id]/variants/[variantId]/versions/route.ts` entirely:

```ts
import { NextRequest } from "next/server";
import { createVersion } from "@/entities/proposal/api/create-version.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const { id, variantId } = await params;
    return Response.json(await createVersion(id, variantId, await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 3: Typecheck + lint + build** — PASS. Legacy `add-version-form.tsx` still POSTs `{note, files}` and reads `{versionId, uploads}` — preserved.

- [ ] **Step 4: Format + commit**

```bash
npx prettier --write src/entities/proposal/api/create-version.server.ts "app/api/proposals/[id]/variants/[variantId]/versions/route.ts"
git add -A
git commit -m "refactor: createVersion guarded server fn + thin POST versions (Stage 2c)"
```

---

### Task 4: `confirmPages` server fn + thin `POST …/versions/[versionId]/pages`

**Files:**

- Create: `src/entities/proposal/api/confirm-pages.server.ts`
- Modify: `app/api/proposals/[id]/variants/[variantId]/versions/[versionId]/pages/route.ts`

- [ ] **Step 1: Server fn** — `src/entities/proposal/api/confirm-pages.server.ts`

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { listObjectNames } from "@/shared/storage";
import { confirmPagesSchema } from "../model/upload-schemas";

export async function confirmPages(
  id: string,
  variantId: string,
  versionId: string,
  input: unknown,
): Promise<void> {
  await requireEditor();
  const { pages } = confirmPagesSchema.parse(input);

  const ver = await db
    .select({ id: proposalVersions.id })
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
  if (ver.length === 0) throw new Error("NOT_FOUND");

  // Every page must reference a real uploaded object under this version's folder
  // (path scheme {proposalId}/{versionId}/{pageId}).
  const prefix = `${id}/${versionId}`;
  const existing = await listObjectNames(prefix);
  for (const p of pages) {
    const name = p.path.startsWith(`${prefix}/`) ? p.path.slice(prefix.length + 1) : "";
    if (!name || name.includes("/") || !existing.has(name)) throw new Error("OBJECT_MISSING");
  }

  await db.insert(proposalPages).values(
    pages.map((p) => ({
      id: p.pageId,
      versionId,
      pageOrder: p.pageOrder,
      storagePath: p.path,
      width: p.width,
      height: p.height,
    })),
  );
  await db
    .update(proposalVariants)
    .set({ currentVersionId: versionId })
    .where(eq(proposalVariants.id, variantId));
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));
}
```

- [ ] **Step 2: Thin the route** — replace `app/api/proposals/[id]/variants/[variantId]/versions/[versionId]/pages/route.ts` entirely:

```ts
import { NextRequest } from "next/server";
import { confirmPages } from "@/entities/proposal/api/confirm-pages.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string; versionId: string }> },
) {
  try {
    const { id, variantId, versionId } = await params;
    await confirmPages(id, variantId, versionId, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

> Divergence: `204` (was `{ ok: true }`); the orchestration only checks `res.ok`. `OBJECT_MISSING` body no longer carries `path`.

- [ ] **Step 3: Typecheck + lint + build** — PASS. Both legacy upload forms' confirm step still works.

- [ ] **Step 4: Format + commit**

```bash
npx prettier --write src/entities/proposal/api/confirm-pages.server.ts "app/api/proposals/[id]/variants/[variantId]/versions/[versionId]/pages/route.ts"
git add -A
git commit -m "refactor: confirmPages guarded server fn + thin POST pages (Stage 2c)"
```

---

### Task 5: `features/add-variant` + rewire `variant-tabs` + delete legacy add-variant-form

**Files:**

- Create: `src/features/add-variant/api/create-variant.ts` (client orchestration)
- Create: `src/features/add-variant/api/use-add-variant.ts` (hook)
- Create: `src/features/add-variant/ui/add-variant-form.tsx`
- Create: `src/features/add-variant/index.ts`
- Modify: `src/legacy/components/proposals/variant-tabs.tsx` (render the feature form)
- Delete: `src/legacy/components/proposals/add-variant-form.tsx`

> Mirrors `features/create-proposal` (orchestration: `measureAll` → POST create → `uploadAll` → POST pages). Files are held in `useState` (no RHF text field for add-variant); validated via the shared schema on submit.

- [ ] **Step 1: Client orchestration** — `src/features/add-variant/api/create-variant.ts` (`"use client"` — it imports the browser-only `@/shared/storage-client`, matching `features/create-proposal/api/create-proposal.ts`)

```ts
"use client";

import { http } from "@/shared/api/http";
import { measureAll, uploadAll, type ConfirmPage } from "@/shared/storage-client";

type CreateResponse = {
  variantId: string;
  versionId: string;
  slug: string;
  label: string;
  uploads: { pageId: string; path: string; token: string; signedUrl: string; pageOrder: number }[];
};

export async function createVariantWithUploads(proposalId: string, files: File[]): Promise<void> {
  const measured = await measureAll(files);
  const created = await http<CreateResponse>(`/api/proposals/${proposalId}/variants`, {
    method: "POST",
    body: JSON.stringify({ files: files.map((f) => ({ contentType: f.type, size: f.size })) }),
  });
  const pages: ConfirmPage[] = await uploadAll(created.uploads, measured);
  await http(
    `/api/proposals/${proposalId}/variants/${created.variantId}/versions/${created.versionId}/pages`,
    { method: "POST", body: JSON.stringify({ pages }) },
  );
}
```

- [ ] **Step 2: Hook** — `src/features/add-variant/api/use-add-variant.ts`

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { createVariantWithUploads } from "./create-variant";

export function useAddVariant(proposalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => createVariantWithUploads(proposalId, files),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}
```

- [ ] **Step 3: UI** — `src/features/add-variant/ui/add-variant-form.tsx`

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ALLOWED_IMAGE_TYPES } from "@/shared/lib/proposals/constants";
import { createVariantSchema } from "@/entities/proposal/model/upload-schemas";
import { useAddVariant } from "../api/use-add-variant";

export function AddVariantForm({
  proposalId,
  onDone,
}: {
  proposalId: string;
  onDone?: () => void;
}) {
  const addVariant = useAddVariant(proposalId);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = createVariantSchema.safeParse({
      files: files.map((f) => ({ contentType: f.type, size: f.size })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "이미지를 확인하세요.");
      return;
    }
    addVariant.mutate(files, {
      onSuccess: () => {
        setFiles([]);
        onDone?.();
      },
      onError: () => setError("안 추가에 실패했습니다."),
    });
  }

  return (
    <form onSubmit={onSubmit} className="border-border space-y-3 rounded-[8px] border p-4">
      <div className="space-y-2">
        <Label htmlFor="variant-files">새 안 이미지 (여러 장 = 페이지)</Label>
        <Input
          id="variant-files"
          type="file"
          multiple
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={addVariant.isPending}>
        {addVariant.isPending ? "업로드 중…" : "안 추가"}
      </Button>
    </form>
  );
}
```

> Reset on success via `setFiles([])` ONLY — do NOT touch `e.currentTarget` in the async `onSuccess` (the SyntheticEvent's `currentTarget` is null by the time `mutate`'s `onSuccess` fires on a later tick). This matches the merged `features/create-proposal` form, which also resets only via `setFiles` and never resets the `<input>` element. Accepted: the file `<input>` keeps its stale filename label after success, but `files` state is `[]` so a re-submit is blocked by `createVariantSchema.min(1)`. (No native `required` on the input — the Zod `.min(1)` guard replaces it, same as create-proposal.)

- [ ] **Step 4: Barrel** — `src/features/add-variant/index.ts`

```ts
export { AddVariantForm } from "./ui/add-variant-form";
```

- [ ] **Step 5: Rewire `variant-tabs.tsx`** — in `src/legacy/components/proposals/variant-tabs.tsx` change the import:

```tsx
import { AddVariantForm } from "@/features/add-variant";
```

(remove `import { AddVariantForm } from "./add-variant-form";`; the JSX `{adding && <AddVariantForm proposalId={proposalId} onDone={() => setAdding(false)} />}` is unchanged — same props.)

- [ ] **Step 6: Delete the legacy form + verify**

```bash
git rm src/legacy/components/proposals/add-variant-form.tsx
grep -rn "proposals/add-variant-form\|add-variant-form" app src   # expect NO output
```

- [ ] **Step 7: Typecheck + lint + build** — PASS.

- [ ] **Step 8: Format + commit**

```bash
npx prettier --write src/features/add-variant src/legacy/components/proposals/variant-tabs.tsx
git add -A
git commit -m "feat: features/add-variant replaces legacy add-variant-form (Stage 2c)"
```

---

### Task 6: `features/add-version` + rewire `proposal-editor-preview` + delete legacy add-version-form

**Files:**

- Create: `src/features/add-version/api/create-version.ts` (client orchestration)
- Create: `src/features/add-version/api/use-add-version.ts` (hook)
- Create: `src/features/add-version/ui/add-version-form.tsx` (RHF for the note field)
- Create: `src/features/add-version/index.ts`
- Modify: `src/legacy/components/preview/proposal-editor-preview.tsx` (render the feature form)
- Delete: `src/legacy/components/proposals/add-version-form.tsx`

- [ ] **Step 1: Client orchestration** — `src/features/add-version/api/create-version.ts` (`"use client"` — imports the browser-only `@/shared/storage-client`)

```ts
"use client";

import { http } from "@/shared/api/http";
import { measureAll, uploadAll, type ConfirmPage } from "@/shared/storage-client";

type CreateResponse = {
  versionId: string;
  versionNo: number;
  uploads: { pageId: string; path: string; token: string; signedUrl: string; pageOrder: number }[];
};

export async function createVersionWithUploads(
  proposalId: string,
  variantId: string,
  note: string,
  files: File[],
): Promise<void> {
  const measured = await measureAll(files);
  const created = await http<CreateResponse>(
    `/api/proposals/${proposalId}/variants/${variantId}/versions`,
    {
      method: "POST",
      body: JSON.stringify({
        note,
        files: files.map((f) => ({ contentType: f.type, size: f.size })),
      }),
    },
  );
  const pages: ConfirmPage[] = await uploadAll(created.uploads, measured);
  await http(
    `/api/proposals/${proposalId}/variants/${variantId}/versions/${created.versionId}/pages`,
    { method: "POST", body: JSON.stringify({ pages }) },
  );
}
```

- [ ] **Step 2: Hook** — `src/features/add-version/api/use-add-version.ts`

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { createVersionWithUploads } from "./create-version";

export function useAddVersion(proposalId: string, variantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ note, files }: { note: string; files: File[] }) =>
      createVersionWithUploads(proposalId, variantId, note, files),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey }),
  });
}
```

- [ ] **Step 3: UI** — `src/features/add-version/ui/add-version-form.tsx`

```tsx
"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ALLOWED_IMAGE_TYPES } from "@/shared/lib/proposals/constants";
import { createVersionSchema } from "@/entities/proposal/model/upload-schemas";
import { useAddVersion } from "../api/use-add-version";

export function AddVersionForm({
  proposalId,
  variantId,
}: {
  proposalId: string;
  variantId: string;
}) {
  const addVersion = useAddVersion(proposalId, variantId);
  const { register, handleSubmit, reset } = useForm<{ note: string }>({
    defaultValues: { note: "" },
  });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  function onSubmit({ note }: { note: string }) {
    setError(null);
    const parsed = createVersionSchema.safeParse({
      note,
      files: files.map((f) => ({ contentType: f.type, size: f.size })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "이미지를 확인하세요.");
      return;
    }
    addVersion.mutate(
      { note: note.trim(), files },
      {
        onSuccess: () => {
          setFiles([]);
          reset();
        },
        onError: () => setError("버전 생성에 실패했습니다."),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="note">변경 메모 (선택)</Label>
        <Input id="note" placeholder="예: 메인 컬러 변경" {...register("note")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="version-files">새 버전 이미지</Label>
        <Input
          id="version-files"
          type="file"
          multiple
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={addVersion.isPending}>
        {addVersion.isPending ? "업로드 중…" : "새 버전 올리기"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Barrel** — `src/features/add-version/index.ts`

```ts
export { AddVersionForm } from "./ui/add-version-form";
```

- [ ] **Step 5: Rewire `proposal-editor-preview.tsx`** — change the import:

```tsx
import { AddVersionForm } from "@/features/add-version";
```

(remove `import { AddVersionForm } from "@/legacy/components/proposals/add-version-form";`; JSX usage `<AddVersionForm proposalId={proposalId} variantId={active.id} />` unchanged.)

- [ ] **Step 6: Delete the legacy form + verify**

```bash
git rm src/legacy/components/proposals/add-version-form.tsx
grep -rn "proposals/add-version-form\|add-version-form" app src   # expect NO output
```

- [ ] **Step 7: Typecheck + lint + build** — PASS.

- [ ] **Step 8: Manual smoke (if a session is available)** — `npm run dev`; on a proposal detail: add a 안 (upload images) → new variant tab appears; add a new 버전 (with optional note + images) → version history grows + preview updates. If no Supabase env, rely on tsc+lint+build and note it.

- [ ] **Step 9: Format + commit**

```bash
npx prettier --write src/features/add-version src/legacy/components/preview/proposal-editor-preview.tsx
git add -A
git commit -m "feat: features/add-version replaces legacy add-version-form (Stage 2c)"
```

---

### Task 7: Stage 2c verification gate + handoff update

**Files:** `docs/superpowers/HANDOFF.md` (the rest is verification only)

- [ ] **Step 1: Full green gate** — Node ≥22: `npx tsc --noEmit && npm run lint && npm test && npm run build` → all PASS. Report the test delta (+~9 upload-schemas + 1 OBJECT_MISSING) and confirm the route table is unchanged in count (same routes, now thin). Read actual counts; don't assert hardcoded absolutes.

- [ ] **Step 2: No-SSR / thin-route check** — the three migrated POST routes have no direct DB/storage access:

```bash
grep -rn "db\.\|drizzle\|createUploadUrl\|listObjectNames" "app/api/proposals/[id]/variants/route.ts" "app/api/proposals/[id]/variants/[variantId]/versions/route.ts" "app/api/proposals/[id]/variants/[variantId]/versions/[versionId]/pages/route.ts"
```

Expected: NO output.

- [ ] **Step 3: FSD layering + barrel safety**

```bash
grep -rn "@/legacy" src/entities/proposal src/features/add-variant src/features/add-version   # expect empty
grep -rn "\.server\"" src/features/add-variant/index.ts src/features/add-version/index.ts     # expect empty
```

All expected empty.

- [ ] **Step 4: server-only safety** — no `"use client"` module reaches a server module:

```bash
grep -rln "use client" src/features/add-variant src/features/add-version | xargs grep -l "\.server\"\|@/shared/db\|@/shared/supabase/service" 2>/dev/null
```

Expected: NO output. (The features import only `@/shared/api/http`, `@/shared/storage-client`, `@/entities/proposal` model + barrel.)

- [ ] **Step 5: legacy upload forms gone; no raw fetch left in the detail write path**

```bash
test ! -f src/legacy/components/proposals/add-variant-form.tsx && test ! -f src/legacy/components/proposals/add-version-form.tsx && echo "both legacy upload forms deleted OK"
grep -rn "fetch(" src/legacy/components/proposals/variant-tabs.tsx src/legacy/components/preview/proposal-editor-preview.tsx   # expect empty (all writes via features/hooks now)
```

- [ ] **Step 6: Update the handoff** — in `docs/superpowers/HANDOFF.md`: add a Stage 2c "Done" entry (createVariant/createVersion/confirmPages guarded entity fns + Zod upload-schemas + thin POST routes; `features/add-variant`/`features/add-version` replace the legacy upload forms; legacy `variant-tabs`/`proposal-editor-preview` rewired to render them; `OBJECT_MISSING` 400 added). Update the test count. **Note explicitly:** the read-only preview components (`proposal-preview`/`fullscreen-slides`/`canvas-view`) + `variant-tabs`/`proposal-editor-preview` shells remain in `src/legacy` (coupled to pins + the public viewer) — their relocation is folded into **Stage 4 (public viewer)**. Set next = **Stage 3** (admin users) per the spec, with Stage 4 (public viewer + preview/pins relocation) after. Carry-forward (still open): non-transactional multi-step mutations. Commit:

```bash
npx prettier --write docs/superpowers/HANDOFF.md
git add docs/superpowers/HANDOFF.md
git commit -m "docs: handoff — Stage 2c done (upload forms migrated), detail write path fully on FSD"
```

---

## Self-Review (completed by author)

- **Spec/handoff coverage:** the two upload forms (add-variant/add-version) migrated to `features/*` (Tasks 5–6); the three inline POST routes thinned + guarded entity fns + Zod (Tasks 1–4); legacy upload forms deleted; legacy `variant-tabs`/`proposal-editor-preview` rewired to render the feature forms. Verification + handoff (Task 7).
- **Scope (Option A, user-approved):** preview components + the editor/viewer shells stay legacy (pins + public-viewer coupling); relocation deferred to Stage 4. Documented in the plan header + handoff.
- **Green-at-every-commit:** Tasks 2–4 thin the routes while the legacy forms still POST the same payloads (Zod accepts; response shapes `{variantId,…,uploads}`/`{versionId,…,uploads}` preserved; 204 satisfies `res.ok`). Each feature migration + its legacy deletion + the rewire is one task (5/6).
- **No-placeholder scan:** all code/commands concrete; new files complete; edits show exact snippets. The add-variant form-reset nuance is called out with the reliable approach (`setFiles([])` in `onSuccess`, no `e.currentTarget` in the async callback).
- **Type consistency:** `CreateVariantInput`/`CreateVersionInput`/`ConfirmPagesInput` (Task 1, built on the existing `fileMetaSchema`) consumed by the server fns (Tasks 2–4); the orchestration response shapes match the server fns' returns; `proposalQueries.detail` invalidation in both hooks; `OBJECT_MISSING` (Task 1) thrown by `confirmPages` (Task 4).
- **Known edges / accepted:** file-validation codes → `VALIDATION_ERROR`; `OBJECT_MISSING` loses its `path` field; pages-confirm → 204; 0-byte files rejected (same as create-proposal). The file `<input>` drops the legacy native `required` attribute — the Zod `.min(1)` guard (with the inline "이미지를 1개 이상 선택하세요" message) replaces it, matching `features/create-proposal`. Non-transactional multi-step writes remain a pre-existing carry-forward. Runtime upload smoke deferred where no Supabase env.

**Adversarial audit (4 lenses: FSD / ordering-green / Next16-RQ-React / behavior-security; high+ findings independently refute-verified — 0 confirmed high/blocker):**

- Fixed (the recurring finding, 3 lenses): removed the contradictory `e.currentTarget?.reset?.()` from the add-variant form's async `onSuccess` (it's a no-op — `currentTarget` is null on a later tick); reset is `setFiles([])` only, matching create-proposal. Prose note corrected to match.
- Fixed (low): both feature orchestration files (`create-variant.ts`/`create-version.ts`) now carry `"use client"` — they import the browser-only `@/shared/storage-client`, exactly as the mirrored `features/create-proposal/api/create-proposal.ts` does.
- Documented (low): the file `<input>`'s native `required` is intentionally replaced by the Zod `.min(1)` guard (create-proposal parity) — added to the divergences list.

## Next: Stage 3 (admin users), then Stage 4 (public viewer + preview/pins relocation)

Per the spec sequence: Stage 3 migrates admin user management; Stage 4 migrates the public viewer `/p/[publicId]` (and is where the shared preview components + pins get relocated out of `src/legacy`); Stage 5 realtime; Stage 6 cleanup + full permission audit + delete `src/legacy`.
