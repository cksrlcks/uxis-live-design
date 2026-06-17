# Refactor Stage 1 — Proposals Core Vertical Slice

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate the proposals CRUD core onto the new architecture — a guarded server read function behind a thin route handler, a React Query `entities/proposal` slice, the proposals **list** page rendered client-side via `useQuery`, and a `features/create-proposal` form built with React Hook Form + Zod — proving the full no-SSR-fetch + server-guard + RHF/Zod pattern end-to-end. Also wires the first CSRF check and adopts `toErrorResponse`.

**Architecture:** Reads flow client → `entities/proposal` queryOptions → `GET /api/proposals` → guarded `getProposals()` server fn → Drizzle. Writes flow RHF form → feature mutation → `POST /api/proposals` → guarded `createProposal()` server fn (Zod-validated) → Drizzle + signed upload URLs → client uploads to Supabase → `POST …/pages` confirm. The create input Zod schema lives in `entities/proposal/model` so both the server fn (entity) and the client form (feature) import it without violating FSD layer order (shared < entities < features < widgets < pages < app).

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), React 19, `@tanstack/react-query` v5, Zod v4, React Hook Form v7 + `@hookform/resolvers`, Drizzle, Supabase, Vitest.

**Source spec:** `docs/superpowers/specs/2026-06-17-fsd-react-query-refactor-design.md` (Stage 1). Builds on Stage 0 (merged): `@→src`, `@drizzle`, `src/shared/api/{http,query-client,to-error-response,same-origin}`, `src/shared/{ui,db,auth,supabase,storage,lib,realtime,config}`, QueryProvider in root layout.

**Scope note:** This plan is the proposals **core** (read + create). Deferred to **Stage 1b**: `app/page.tsx`→`src/pages/home`, `dashboard/page.tsx`→`src/pages/dashboard-home`, and the `(auth)` forms → `features/auth` (RHF+Zod, server actions kept). Those pages keep working unchanged meanwhile.

**Conventions:**
- TDD (red-green) for PURE logic: the Zod schema and the query factory. Integration code (server fns hitting Drizzle/Supabase, route handlers, pages) has no unit tests in this repo's style — verify via `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, and manual smoke. State this honestly per task.
- One commit per task. Format touched/new files with Prettier before committing (`npx prettier --write <files>`).
- FSD: entity `index.ts` barrels export ONLY client-safe modules (query factory, types) — NEVER `*.server.ts` (server-only). Route handlers import `*.server.ts` directly.

---

### Task 1: `entities/proposal` read slice

**Files:**
- Create: `src/entities/proposal/model/types.ts`
- Create: `src/entities/proposal/api/get-proposals.server.ts`
- Create: `src/entities/proposal/api/get-proposals.ts`
- Create: `src/entities/proposal/api/proposal.query.ts`
- Create: `src/entities/proposal/index.ts`
- Test: `tests/entities/proposal/proposal.query.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/entities/proposal/proposal.query.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { proposalQueries } from "@/entities/proposal";

describe("proposalQueries", () => {
  it("builds hierarchical query keys", () => {
    expect(proposalQueries.all()).toEqual(["proposals"]);
    expect(proposalQueries.lists()).toEqual(["proposals", "list"]);
  });

  it("list() returns queryOptions with the list key and a queryFn", () => {
    const opts = proposalQueries.list();
    expect(opts.queryKey).toEqual(["proposals", "list"]);
    expect(typeof opts.queryFn).toBe("function");
  });
});
```

- [ ] **Step 2: Run test → FAIL** — `npm test -- tests/entities/proposal/proposal.query.test.ts` → "Cannot find module '@/entities/proposal'".

- [ ] **Step 3: Implement**

`src/entities/proposal/model/types.ts`:
```ts
export type { Proposal } from "@drizzle/schema";
```

`src/entities/proposal/api/get-proposals.server.ts`:
```ts
import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, type Proposal } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";

export async function getProposals(): Promise<Proposal[]> {
  await requireEditor();
  return db.select().from(proposals).orderBy(desc(proposals.updatedAt));
}
```

`src/entities/proposal/api/get-proposals.ts`:
```ts
import { http } from "@/shared/api/http";
import type { Proposal } from "../model/types";

export function getProposals(): Promise<Proposal[]> {
  return http<Proposal[]>("/api/proposals");
}
```

`src/entities/proposal/api/proposal.query.ts`:
```ts
import { queryOptions } from "@tanstack/react-query";
import { getProposals } from "./get-proposals";

export const proposalQueries = {
  all: () => ["proposals"] as const,
  lists: () => [...proposalQueries.all(), "list"] as const,
  list: () =>
    queryOptions({
      queryKey: proposalQueries.lists(),
      queryFn: getProposals,
    }),
};
```

`src/entities/proposal/index.ts` (public API — NO server fn):
```ts
export { proposalQueries } from "./api/proposal.query";
export { getProposals as fetchProposals } from "./api/get-proposals";
export type { Proposal } from "./model/types";
```
> Latent type note (not a Stage-1 break): `Proposal` is the DB row (`$inferSelect`), so `createdAt`/`updatedAt` are typed `Date`. Over HTTP, `Response.json` serializes them to ISO strings, so the wire value is actually a string. The list page (Task 6) renders none of the Date fields, so nothing breaks now. When a future stage renders/parses a timestamp from a fetched `Proposal`, introduce a client DTO (`Omit<Proposal,'createdAt'|'updatedAt'> & { createdAt: string; updatedAt: string }`) rather than calling `Date` methods on the wire value.

- [ ] **Step 4: Run test → PASS** — `npm test -- tests/entities/proposal/proposal.query.test.ts` (2 tests).

- [ ] **Step 5: Typecheck** — `npx tsc --noEmit` → exit 0.

- [ ] **Step 6: Format + commit**
```bash
npx prettier --write src/entities/proposal tests/entities/proposal
git add src/entities/proposal tests/entities/proposal
git commit -m "feat: entities/proposal read slice (query factory + guarded server fn) (Stage 1)"
```

---

### Task 2: `GET /api/proposals` → thin wrapper + `toErrorResponse`

**Files:**
- Modify: `app/api/proposals/route.ts` (GET only)

- [ ] **Step 1: Replace the GET handler** in `app/api/proposals/route.ts`. Change the imports + GET so it delegates to the guarded server fn and maps errors via `toErrorResponse`. The existing GET is:
```ts
export async function GET() {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const rows = await db.select().from(proposals).orderBy(desc(proposals.updatedAt));
  return NextResponse.json(rows);
}
```
Replace it with:
```ts
import { getProposals } from "@/entities/proposal/api/get-proposals.server";
import { toErrorResponse } from "@/shared/api/to-error-response";
// ...
export async function GET() {
  try {
    return Response.json(await getProposals());
  } catch (error) {
    return toErrorResponse(error);
  }
}
```
Remove now-unused GET-only imports (`desc`, and `proposals`/`db`/`requireEditor` ONLY if the POST handler no longer needs them — POST still uses them in this task, so keep those; just remove `desc` if nothing else uses it). Verify with tsc which imports are unused.

- [ ] **Step 2: Typecheck + build** — `npx tsc --noEmit && npm run build` → both PASS.

- [ ] **Step 3: Manual smoke** — `npm run dev`; as a signed-in editor, `curl -s -b <session-cookie> http://localhost:3000/api/proposals` returns the JSON array (or load the dashboard later in Task 6). A request with no/invalid editor session returns HTTP 403 `{"error":"FORBIDDEN"}`. Stop dev. (If you cannot easily obtain a session cookie, defer the live check to Task 6's page smoke and rely on tsc+build here — note which you did.)

- [ ] **Step 4: Commit**
```bash
npx prettier --write "app/api/proposals/route.ts"
git add app/api/proposals/route.ts
git commit -m "refactor: GET /api/proposals delegates to guarded server fn + toErrorResponse (Stage 1)"
```

---

### Task 3: `entities/proposal/model/create-schema.ts` — Zod (TDD)

**Files:**
- Create: `src/entities/proposal/model/create-schema.ts`
- Test: `tests/entities/proposal/create-schema.test.ts`

> The create schema is an entity model (shared by the server create fn and the client form). It reuses the file constraints already defined in `@/shared/lib/proposals/constants`.
> Intended tightening vs the old route: `size` gets `.int().positive()`, so a 0-byte file (silently accepted by the old API, then failing at upload) is now rejected with `VALIDATION_ERROR`. The MAX boundary is unchanged (old `> MAX` rejects; zod `.max(MAX)` accepts exactly MAX). This is a strictly safer constraint, not an accident.

- [ ] **Step 1: Write the failing test** — `tests/entities/proposal/create-schema.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { createProposalSchema } from "@/entities/proposal/model/create-schema";

const okFile = { contentType: "image/png", size: 1000 };

describe("createProposalSchema", () => {
  it("accepts a valid payload", () => {
    const r = createProposalSchema.safeParse({ title: "A", files: [okFile] });
    expect(r.success).toBe(true);
  });

  it("trims and rejects an empty title", () => {
    expect(createProposalSchema.safeParse({ title: "   ", files: [okFile] }).success).toBe(false);
  });

  it("requires at least one file", () => {
    expect(createProposalSchema.safeParse({ title: "A", files: [] }).success).toBe(false);
  });

  it("rejects a disallowed content type", () => {
    expect(
      createProposalSchema.safeParse({ title: "A", files: [{ contentType: "image/gif", size: 10 }] }).success,
    ).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const huge = { contentType: "image/png", size: 25 * 1024 * 1024 + 1 };
    expect(createProposalSchema.safeParse({ title: "A", files: [huge] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test → FAIL** — `npm test -- tests/entities/proposal/create-schema.test.ts`.

- [ ] **Step 3: Implement** — `src/entities/proposal/model/create-schema.ts`
```ts
import { z } from "zod";
import { ALLOWED_IMAGE_TYPES, MAX_PAGE_BYTES } from "@/shared/lib/proposals/constants";

export const titleSchema = z.string().trim().min(1, "제목을 입력하세요");

export const fileMetaSchema = z.object({
  contentType: z
    .string()
    .refine((t) => ALLOWED_IMAGE_TYPES.includes(t), "지원하지 않는 이미지 형식입니다"),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_BYTES, "파일이 너무 큽니다 (최대 25MB)"),
});

export const createProposalSchema = z.object({
  title: titleSchema,
  files: z.array(fileMetaSchema).min(1, "이미지를 1개 이상 선택하세요"),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
```

- [ ] **Step 4: Run test → PASS** (5 tests).

- [ ] **Step 5: Format + commit**
```bash
npx prettier --write src/entities/proposal/model/create-schema.ts tests/entities/proposal/create-schema.test.ts
git add src/entities/proposal/model/create-schema.ts tests/entities/proposal/create-schema.test.ts
git commit -m "feat: proposal create Zod schema (shared client+server) (Stage 1)"
```

---

### Task 4: `createProposal()` server fn + `POST /api/proposals` thin wrapper

**Files:**
- Create: `src/entities/proposal/api/create-proposal.server.ts`
- Modify: `app/api/proposals/route.ts` (POST)

> The current POST inlines: validate title/files, generate publicId, insert proposal/variant/version, create signed upload URLs. We move that into a guarded server fn that Zod-validates the input, and reduce the route to a thin wrapper. Behavior (response shape `{proposalId, publicId, variantId, versionId, uploads}`) is preserved.

- [ ] **Step 1: Implement the server fn** — `src/entities/proposal/api/create-proposal.server.ts`
```ts
import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { generatePublicId } from "@/shared/lib/proposals/public-id";
import { extForContentType, pagePath } from "@/shared/lib/proposals/constants";
import { createUploadUrl } from "@/shared/storage";
import { createProposalSchema } from "../model/create-schema";

export async function createProposal(input: unknown) {
  const editor = await requireEditor();
  const { title, files } = createProposalSchema.parse(input);

  let publicId = "";
  for (let i = 0; i < 5; i++) {
    const cand = generatePublicId();
    const exists = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(eq(proposals.publicId, cand))
      .limit(1);
    if (exists.length === 0) {
      publicId = cand;
      break;
    }
  }
  if (!publicId) throw new Error("ID_GENERATION_FAILED");

  const proposalId = randomUUID();
  const variantId = randomUUID();
  const versionId = randomUUID();
  await db.insert(proposals).values({ id: proposalId, publicId, title, ownerId: editor.id });
  await db.insert(proposalVariants).values({
    id: variantId,
    proposalId,
    label: "A",
    slug: "a",
    sortOrder: 0,
    createdBy: editor.id,
  });
  await db.insert(proposalVersions).values({ id: versionId, variantId, versionNo: 1, createdBy: editor.id });

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(files[i].contentType)!;
    const pageId = randomUUID();
    const path = pagePath(proposalId, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({ pageId, path, token: signed.token, signedUrl: signed.signedUrl, pageOrder: i });
  }

  return { proposalId, publicId, variantId, versionId, uploads };
}
```
> Note: `createProposalSchema.parse(input)` throws `ZodError` on bad input → the route's `toErrorResponse` maps it to 400 `VALIDATION_ERROR`. `extForContentType` is non-null here because the schema already restricted `contentType` to `ALLOWED_IMAGE_TYPES`.
> Known divergence (acceptable): the thin POST does `await req.json()` before `createProposal()` runs `requireEditor()`. So a *malformed-JSON body from a non-editor* now yields 500 `INTERNAL_ERROR` instead of the old 403 `FORBIDDEN` (guard ran first). This is a narrow edge (malformed body + non-editor + same-origin) and not worth coupling the entity fn to `Request`; well-formed unauthorized requests still get 403 from `requireEditor`.

- [ ] **Step 2: Replace the POST handler** in `app/api/proposals/route.ts` with a thin wrapper:
```ts
import { createProposal } from "@/entities/proposal/api/create-proposal.server";
// ...
export async function POST(req: NextRequest) {
  try {
    const result = await createProposal(await req.json());
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
```
Then delete every import in `route.ts` now unused by either handler (after this task the route only needs `NextRequest` from next/server, `getProposals`, `createProposal`, `toErrorResponse`). Remove `db`, `proposals`, `proposalVariants`, `proposalVersions`, `eq`, `randomUUID`, `requireEditor`, `generatePublicId`, the constants, `createUploadUrl`, `NextResponse` — verify with tsc that nothing dangling remains.

- [ ] **Step 3: Typecheck + build** — `npx tsc --noEmit && npm run build` → PASS.

- [ ] **Step 4: Commit**
```bash
npx prettier --write src/entities/proposal/api/create-proposal.server.ts app/api/proposals/route.ts
git add src/entities/proposal/api/create-proposal.server.ts app/api/proposals/route.ts
git commit -m "refactor: createProposal guarded server fn + thin POST /api/proposals (Stage 1)"
```

---

### Task 5: `features/create-proposal` (RHF + Zod) + client upload helpers

**Files:**
- Move: `src/legacy/lib/proposals/upload-client.ts` → `src/shared/storage-client.ts`
- Create: `src/features/create-proposal/api/create-proposal.ts` (client orchestration)
- Create: `src/features/create-proposal/api/use-create-proposal.ts` (useMutation)
- Create: `src/features/create-proposal/ui/proposal-create-form.tsx` (RHF)
- Create: `src/features/create-proposal/index.ts`
- Create: `src/pages/proposal-new/ui/proposal-new-page.tsx`
- Create: `src/pages/proposal-new/index.ts`
- Modify: `app/(dashboard)/dashboard/proposals/new/page.tsx` (re-export)
- Delete: `src/legacy/components/proposals/proposal-create-form.tsx`

- [ ] **Step 1: Move the client upload helpers (and fix ALL importers)**

⚠️ `upload-client.ts` is imported by THREE legacy files, not one: the create form (deleted in Step 8) **and** `src/legacy/components/proposals/add-variant-form.tsx` + `src/legacy/components/proposals/add-version-form.tsx` (both still LIVE via proposal-detail — not migrated until Stage 2). Move the file, then repoint the two surviving importers, or the build breaks.
```bash
git mv src/legacy/lib/proposals/upload-client.ts src/shared/storage-client.ts
# Repoint the two still-live legacy importers to the new shared location:
perl -pi -e 's{\@/legacy/lib/proposals/upload-client}{\@/shared/storage-client}g' \
  src/legacy/components/proposals/add-variant-form.tsx \
  src/legacy/components/proposals/add-version-form.tsx
# Guard: nothing may reference the old path anymore.
grep -rn "legacy/lib/proposals/upload-client" app src   # expect NO output
```
The moved file already imports `@/shared/supabase/client` and `@/shared/lib/proposals/constants` (Stage 0), so its body needs no edits. (legacy→shared imports are allowed by FSD.)

- [ ] **Step 2: Client orchestration** — `src/features/create-proposal/api/create-proposal.ts`
```ts
import { http } from "@/shared/api/http";
import { measureAll, uploadAll, type ConfirmPage } from "@/shared/storage-client";
import type { CreateProposalInput } from "@/entities/proposal/model/create-schema";

type CreateResponse = {
  proposalId: string;
  publicId: string;
  variantId: string;
  versionId: string;
  uploads: { pageId: string; path: string; token: string; signedUrl: string; pageOrder: number }[];
};

export async function createProposalWithUploads(title: string, files: File[]): Promise<{ proposalId: string }> {
  const measured = await measureAll(files);

  const body: CreateProposalInput = {
    title,
    files: files.map((f) => ({ contentType: f.type, size: f.size })),
  };
  const created = await http<CreateResponse>("/api/proposals", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const pages: ConfirmPage[] = await uploadAll(created.uploads, measured);

  await http(
    `/api/proposals/${created.proposalId}/variants/${created.variantId}/versions/${created.versionId}/pages`,
    { method: "POST", body: JSON.stringify({ pages }) },
  );

  return { proposalId: created.proposalId };
}
```

- [ ] **Step 3: Mutation hook** — `src/features/create-proposal/api/use-create-proposal.ts`
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { createProposalWithUploads } from "./create-proposal";

export function useCreateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, files }: { title: string; files: File[] }) =>
      createProposalWithUploads(title, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalQueries.lists() });
    },
  });
}
```

- [ ] **Step 4: RHF form** — `src/features/create-proposal/ui/proposal-create-form.tsx`
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
import { ALLOWED_IMAGE_TYPES } from "@/shared/lib/proposals/constants";
import { createProposalSchema, titleSchema } from "@/entities/proposal/model/create-schema";
import { useCreateProposal } from "../api/use-create-proposal";

const formSchema = z.object({ title: titleSchema });
type FormValues = z.infer<typeof formSchema>;

export function ProposalCreateForm() {
  const router = useRouter();
  const createProposal = useCreateProposal();
  const [files, setFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  async function onSubmit({ title }: FormValues) {
    setFormError(null);

    // Validate files against the shared schema (single source of truth).
    const parsed = createProposalSchema.safeParse({
      title,
      files: files.map((f) => ({ contentType: f.type, size: f.size })),
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "입력을 확인하세요.");
      return;
    }

    try {
      const { proposalId } = await createProposal.mutateAsync({ title, files });
      router.push(`/dashboard/proposals/${proposalId}`);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">제목</Label>
        <Input id="title" {...register("title")} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="files">이미지 (여러 장 선택 가능, 순서대로 페이지가 됩니다)</Label>
        <Input
          id="files"
          type="file"
          multiple
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <Button type="submit" disabled={createProposal.isPending}>
        {createProposal.isPending ? "업로드 중…" : "시안 만들기"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Feature barrel** — `src/features/create-proposal/index.ts`
```ts
export { ProposalCreateForm } from "./ui/proposal-create-form";
```

- [ ] **Step 6: Page** — `src/pages/proposal-new/ui/proposal-new-page.tsx`
```tsx
import { ProposalCreateForm } from "@/features/create-proposal";

export function ProposalNewPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">새 시안</h1>
      <p className="mt-2 text-sm text-muted-foreground">제목과 이미지를 올리면 v1이 자동 생성됩니다.</p>
      <div className="mt-6">
        <ProposalCreateForm />
      </div>
    </div>
  );
}
```
`src/pages/proposal-new/index.ts`:
```ts
export { ProposalNewPage } from "./ui/proposal-new-page";
```

- [ ] **Step 7: Re-export from the route** — replace `app/(dashboard)/dashboard/proposals/new/page.tsx` with:
```tsx
export { ProposalNewPage as default } from "@/pages/proposal-new";
```

- [ ] **Step 8: Delete the legacy form**
```bash
git rm src/legacy/components/proposals/proposal-create-form.tsx
```
(Confirm nothing else imports it: `grep -rn "proposal-create-form" app src` → no results.)

- [ ] **Step 9: Typecheck + build** — `npx tsc --noEmit && npm run build` → PASS.

- [ ] **Step 10: Manual smoke** — `npm run dev`; sign in as editor, go to `/dashboard/proposals/new`, submit with empty title → inline "제목을 입력하세요"; with no files → "이미지를 1개 이상 선택하세요"; with a title + images → creates and navigates to the detail page. Stop dev. (If a live session is impractical, rely on tsc+build and note it; the page smoke is fully exercised in Task 6/Stage 1b.)

- [ ] **Step 11: Format + commit**
```bash
npx prettier --write src/features/create-proposal src/pages/proposal-new src/shared/storage-client.ts "app/(dashboard)/dashboard/proposals/new/page.tsx"
git add -A
git commit -m "feat: features/create-proposal (RHF+Zod) + shared storage-client; drop legacy form (Stage 1)"
```

---

### Task 6: Proposals **list** page → client-side `useQuery`

**Files:**
- Create: `src/pages/proposals-list/ui/proposals-list-page.tsx`
- Create: `src/pages/proposals-list/index.ts`
- Modify: `app/(dashboard)/dashboard/proposals/page.tsx` (re-export)

- [ ] **Step 1: Client list page** — `src/pages/proposals-list/ui/proposals-list-page.tsx`
```tsx
"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { buttonVariants } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

export function ProposalsListPage() {
  const { data: rows, isPending, isError } = useQuery(proposalQueries.list());

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">시안</h1>
        <Link href="/dashboard/proposals/new" className={buttonVariants()}>
          새 시안
        </Link>
      </div>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>제목</TableHead>
            <TableHead>공개 ID</TableHead>
            <TableHead>공개 상태</TableHead>
            <TableHead className="text-right">링크</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                불러오는 중…
              </TableCell>
            </TableRow>
          )}

          {isError && (
            <TableRow>
              <TableCell colSpan={4} className="text-destructive">
                목록을 불러오지 못했습니다.
              </TableCell>
            </TableRow>
          )}

          {rows?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                아직 시안이 없습니다.
              </TableCell>
            </TableRow>
          )}

          {rows?.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link href={`/dashboard/proposals/${p.id}`} className="underline">
                  {p.title}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs">{p.publicId}</TableCell>
              <TableCell>
                <Badge variant={p.visibility === "public" ? "default" : "outline"}>
                  {p.visibility === "public" ? (p.accessPasswordHash ? "공개+비번" : "공개") : "비공개"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/p/${p.publicId}`} className="text-sm underline" target="_blank">
                  뷰어 열기
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```
`src/pages/proposals-list/index.ts`:
```ts
export { ProposalsListPage } from "./ui/proposals-list-page";
```

- [ ] **Step 2: Re-export from the route** — replace `app/(dashboard)/dashboard/proposals/page.tsx` with:
```tsx
export { ProposalsListPage as default } from "@/pages/proposals-list";
```

- [ ] **Step 3: Typecheck + build** — `npx tsc --noEmit && npm run build` → PASS.

- [ ] **Step 4: Manual smoke** — `npm run dev`; sign in as editor → `/dashboard/proposals` shows "불러오는 중…" then the list (no SSR; data arrives via `GET /api/proposals`). Create one via `/dashboard/proposals/new` and confirm the list updates (cache invalidation from Task 5's mutation). A signed-out request to the page still hits the server layout redirect (auth gating preserved). Stop dev.

- [ ] **Step 5: Format + commit**
```bash
npx prettier --write src/pages/proposals-list "app/(dashboard)/dashboard/proposals/page.tsx"
git add -A
git commit -m "feat: proposals-list page client-side via useQuery (no SSR) (Stage 1)"
```

---

### Task 7: CSRF wiring in `proxy.ts` + `server-only` on `service.ts`

**Files:**
- Modify: `proxy.ts`
- Modify: `src/shared/supabase/service.ts`

- [ ] **Step 1: Harden the service-role client** — prepend `import "server-only";` as the FIRST line of `src/shared/supabase/service.ts` (it holds the `SUPABASE_SECRET_KEY` and must never reach a client bundle). Confirm no `"use client"` module imports it: `grep -rln "@/shared/supabase/service" src app` → only server files (storage.ts is server-only; route handlers).

- [ ] **Step 2: Add the same-origin (CSRF) check** to `proxy.ts`. Replace the ENTIRE file with the following (this moves the single `const path` declaration to the top — do NOT leave the old `const path` line further down, or tsc fails with a redeclaration):
```ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSameOrigin } from "@/shared/api/same-origin";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // CSRF: reject cross-origin state-changing requests to our API.
  const method = request.method;
  const isMutation =
    method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
  if (path.startsWith("/api/") && isMutation) {
    if (!isSameOrigin(request.headers.get("origin"), request.headers.get("host"))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect the dashboard + admin areas: unauthenticated -> /login
  if (path.startsWith("/dashboard") || path.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
```
> Known consequence (verified): the guard rejects `/api` mutations lacking an `Origin` header (`isSameOrigin` returns false when origin is null). Browsers always send `Origin` on POST/PUT/PATCH/DELETE, and Supabase `uploadToSignedUrl` goes to the Supabase host (not `/api`), so the create flow is unaffected. Any future server-to-server caller of an `/api` mutation must send `Origin` or be exempted.

- [ ] **Step 3: Typecheck + build** — `npx tsc --noEmit && npm run build` → PASS.

- [ ] **Step 4: Manual smoke** — `npm run dev`; same-origin create still works (Task 5 flow). A cross-origin mutation is rejected: `curl -s -o /dev/null -w "%{http_code}" -X POST -H "Origin: https://evil.example" -H "Content-Type: application/json" -d '{}' http://localhost:3000/api/proposals` → `403`. A same-origin `curl` with `-H "Origin: http://localhost:3000" -H "Host: localhost:3000"` is NOT rejected by the CSRF check (it then hits auth/validation). Stop dev.

- [ ] **Step 5: Format + commit**
```bash
npx prettier --write proxy.ts src/shared/supabase/service.ts
git add proxy.ts src/shared/supabase/service.ts
git commit -m "feat: same-origin CSRF guard for /api mutations + server-only service client (Stage 1)"
```

---

### Task 8: Stage 1 verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full green gate** — `npx tsc --noEmit && npm run lint && npm test && npm run build` → all PASS. Report test count + route count.

- [ ] **Step 2: No-SSR check (Goal 4)** — the migrated proposals pages must not fetch on the server. Verify:
```bash
grep -rn "@/shared/db\|@drizzle/schema\|loadVariants\|@/shared/storage\"" src/pages/proposals-list src/pages/proposal-new src/features/create-proposal
```
Expected: NO output (these client pages/feature import only via `@/entities/proposal` query/mutation + `@/shared/api/http`, never the DB/server modules). Also confirm `app/(dashboard)/dashboard/proposals/page.tsx` is a one-line re-export (no `db.select`).

- [ ] **Step 3: FSD layering check** — lower layers must not import higher ones, and entity barrels must not leak server-only:
```bash
grep -rn "@/features/\|@/widgets/\|@/pages/" src/entities src/shared        # expect empty
grep -rn "@/widgets/\|@/pages/" src/features                                 # expect empty
grep -rn "\.server" src/entities/proposal/index.ts                           # expect empty (no server fn in barrel)
grep -rn "@/legacy" src/entities src/features src/pages                      # expect empty (no new legacy deps)
grep -rn "legacy/lib/proposals/upload-client" app src                        # expect empty (moved to @/shared/storage-client)
```
All five expected empty.

- [ ] **Step 4: server-only safety** — confirm no `"use client"` file transitively imports a `*.server.ts` or `@/shared/storage`/`@/shared/supabase/service`:
```bash
grep -rln "use client" src | xargs grep -l "\.server\"\|@/shared/storage\"\|@/shared/supabase/service" 2>/dev/null
```
Expected: NO output.

- [ ] **Step 5: Final commit (only if fixups were needed)**
```bash
git add -A && git commit -m "chore: Stage 1 verification fixups" || echo "nothing to commit"
```

---

## Self-Review (completed by author)

- **Spec coverage (Stage 1 core):** entities/proposal read slice + guarded server fn (Task 1), GET thin wrapper + toErrorResponse (Task 2), shared create Zod schema (Task 3), guarded create server fn + thin POST (Task 4), features/create-proposal RHF+Zod + shared storage-client + new page (Task 5), list page client `useQuery` (Task 6), CSRF wiring + service.ts server-only (Task 7), verification incl. no-SSR + FSD-layering gates (Task 8).
- **Deviation from spec (documented):** the create Zod schema lives in `entities/proposal/model/create-schema.ts` rather than `features/create-proposal/model/` — it is shared by the server create fn (entity layer) and the client form (feature layer); placing it in the feature would force the entity to import upward (FSD violation). The feature still owns the mutation, orchestration, and form. The RHF form validates the `title` field via `zodResolver` and the file list via the shared `createProposalSchema` on submit (single source of truth for file constraints).
- **Deferred to Stage 1b (noted in scope):** home/dashboard page re-exports, `(auth)` forms migration.
- **Placeholder scan:** none — all code/commands concrete.
- **Type consistency:** `proposalQueries` (Task 1) consumed by list page (Task 6) + mutation invalidation (Task 5); `createProposalSchema`/`CreateProposalInput` (Task 3) consumed by server fn (Task 4) + feature orchestration/form (Task 5); `getProposals` server fn (Task 1) consumed by GET (Task 2); `createProposal` server fn (Task 4) consumed by POST (Task 4); `isSameOrigin` (Stage 0) consumed by proxy (Task 7). The `ConfirmPage`/`UploadSpec` types come from the relocated `shared/storage-client`.

**Adversarial audit (3 lenses: FSD / RQ-RHF-Zod-Next16 / behavior-preservation) applied:**
- Fixed 1 blocker: `upload-client.ts` has THREE importers (the deleted create form + the still-live `add-variant-form` and `add-version-form`). Task 5 now repoints both survivors to `@/shared/storage-client` and adds a grep guard; Task 8 verifies the old path is gone.
- Made the proxy.ts edit unambiguous (full final file, single `const path`).
- Documented intended divergences: validation errors → 400 `VALIDATION_ERROR`; 0-byte files now rejected; malformed-body-from-non-editor → 500 (narrow edge); Origin-less `/api` mutations rejected by CSRF.
- Noted latent `Proposal` Date-vs-wire-string typing for a future DTO (not a Stage-1 break).

## Next: Stage 1b, then Stage 2
After Stage 1 lands: write Stage 1b (home/dashboard re-exports + `features/auth` RHF/Zod with server actions retained), then Stage 2 (variants/versions + proposal-detail, including the guarded editor-images GET the spec/audit flagged).
