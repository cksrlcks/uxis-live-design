# Refactor Stage 2a — Proposal Detail Read (client-side) + Public Image URLs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move the proposal **detail/editor** read off the server (RSC) onto the client via React Query, behind a single guarded `GET /api/proposals/[id]`, and **drop image read-signing entirely** — the storage bucket becomes public and pages are served via permanent `publicUrl(path)`. The detail page flips to a client `src/pages/proposal-detail`; the existing legacy edit components keep working by invalidating the detail query instead of `router.refresh()` (their full migration to `features/*` is Stage 2b/2c).

**Architecture:** Read flows client page `useQuery(proposalQueries.detail(id))` → client fetcher (`@/shared/api/http`) → thin `GET /api/proposals/[id]` → guarded `getProposalDetail()` `*.server.ts` (`requireEditor` + Drizzle, builds `publicUrl` for each page) → `toErrorResponse`. The detail DTO (`ProposalDetail` = proposal subset + `EditorVariant[]` with versions + current-version pages) is defined in `entities/proposal/model`; the legacy preview type files re-export it so the legacy preview/edit components need no import changes. Images are public (bucket `public: true`), so there is **no signed-URL expiry and no guarded image route** — this supersedes the spec/handoff's "guarded editor-images GET".

**Tech Stack:** Next.js 16 (App Router, Route Handlers), React 19, `@tanstack/react-query` v5, Drizzle, Supabase Storage (public bucket), Vitest (node env).

**Source spec:** `docs/superpowers/specs/2026-06-17-fsd-react-query-refactor-design.md`. **Handoff:** `docs/superpowers/HANDOFF.md`. Builds on Stage 0/1/1b (merged): `@→src`, `@drizzle`, `shared/api/{http,to-error-response}`, `entities/proposal` (list slice), `features/auth`, etc.

**Decision changes (user-approved, this stage):**

1. **Drop image read-signing.** The `proposals` bucket becomes **public**; reads use `publicUrl(path)`. This removes `createReadUrl`/`createReadUrls` and the planned guarded editor-images GET (the audit's "security blocker" no longer applies — there is nothing to guard). Accepted tradeoff: image bytes are protected only by unguessable UUID paths, not by the visibility/password gate. Uploads keep signed upload URLs (write access stays controlled).
2. **Stage 2 is split** into 2a (this: detail **read** + storage), 2b (detail **edit** mutations → `features/*`), 2c (variant/version **upload** forms → `features/*` + thin routes). 2a keeps the legacy edit components working via query invalidation.

## Global Constraints

- **Node ≥22** (`package.json` engines; `next build` needs it). Already active on the dev machine (v22.18.0 via nvm) — do not switch Node.
- **FSD layer order:** `shared < entities < features < pages < app`. `entities`/`features` must **not** import `@/legacy`. **Exception (this stage):** `src/pages/proposal-detail` may temporarily compose legacy _component_ modules (`@/legacy/components/...`) until Stage 2b/2c promote them to `features/*` — but it must never import legacy _data/loaders_ (`@/legacy/lib/...`). The reverse (legacy importing `@/entities` or `@/shared`) **is** allowed — legacy is the temp holding area being promoted. Entity `index.ts` barrels export only client-safe modules (never `*.server.ts`).
- **No-SSR data-fetch:** the detail page must not fetch data on the server. The app route may `await params` (routing, not data). Auth gating stays server-side (`(dashboard)/layout.tsx` + `proxy.ts`).
- **Images are public:** server builds `publicUrl(storagePath)`; no signing on read. Uploads still use `createUploadUrl` (signed, server-only).
- **TDD (red-green) for PURE logic only:** the `publicUrl` helper. Integration code (server fns, route handlers, client pages, the legacy-component rewiring) has no unit tests in this repo's style (node-env Vitest, no React render harness) — verify via `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, plus the grep gates. State honestly per task.
- **One commit per task.** Prettier-format touched/new files before committing. `format:check` stays globally red on not-yet-migrated `src/legacy` + `app/` — only format what you touch.
- **Keep the app green at every commit.** In particular, flipping the detail page to client (Task 4) and rewiring its mutation components to invalidate the detail query are **one atomic task** — splitting them leaves a commit where edits don't refresh the view.

### Documented behavior divergences (intended)

- Editor detail page no longer SSR-fetches; it shows a brief loading state then renders via React Query.
- Image URLs are now **permanent public URLs** (no 1-hour expiry). Visibility/password gate the viewer page/metadata, not raw image bytes.
- `GET /api/proposals/[id]` response shape changes from `{ proposal, variants, versions }` (flat) to `{ proposal: {id,title,publicId,visibility,hasPassword}, variants: EditorVariant[] }` (nested, with pages+versions). Only the detail page consumes it.
- A deleted/missing proposal surfaces as an inline "not found" state in the client page (was `notFound()`); the `(dashboard)` layout still gates auth server-side. Likewise, a proposal with **zero variants** renders an inline "표시할 안이 없습니다." (the RSC page used `notFound()` for this invariant); both replace the framework 404 page. Non-404 read errors (500/403) share the generic "시안을 불러오지 못했습니다." message.

---

### Task 1: `publicUrl` helper + make the storage bucket public

**Files:**

- Modify: `src/shared/lib/proposals/constants.ts` (add `publicUrl`)
- Test: `tests/proposals/constants.test.ts` (add a `publicUrl` case)
- Modify: `scripts/setup-bucket.mts` (create public + flip existing to public)

> `publicUrl` is a pure string builder (no Supabase call) usable on server and client. The bucket flip is an ops change applied via the existing setup script.

- [ ] **Step 1: Add the failing test** — in `tests/proposals/constants.test.ts`, **merge `publicUrl` + `PROPOSALS_BUCKET` into the existing `@/shared/lib/proposals/constants` import** (do NOT add a second import statement — ESLint `import/no-duplicates` is active), then append a new `describe`:

```ts
// existing import becomes, e.g.:
// import { extForContentType, pagePath, ALLOWED_IMAGE_TYPES, MAX_PAGE_BYTES, publicUrl, PROPOSALS_BUCKET } from "@/shared/lib/proposals/constants";

describe("publicUrl", () => {
  it("builds a public object URL from the bucket + path", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    expect(publicUrl("a/b/c.png")).toBe(
      `https://proj.supabase.co/storage/v1/object/public/${PROPOSALS_BUCKET}/a/b/c.png`,
    );
  });
});
```

> Read the file first and extend its actual existing import line (the symbols it already pulls from `constants` vary); add only `publicUrl` and `PROPOSALS_BUCKET` if not already imported.

- [ ] **Step 2: Run → FAIL** — `npm test -- tests/proposals/constants.test.ts` ("publicUrl is not a function" / undefined).

- [ ] **Step 3: Implement** — add to `src/shared/lib/proposals/constants.ts` (after `pagePath`):

```ts
// Permanent public URL for an object in the (public) proposals bucket.
// Reads NEXT_PUBLIC_SUPABASE_URL at call time so it works on server and client.
export function publicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PROPOSALS_BUCKET}/${path}`;
}
```

- [ ] **Step 4: Run → PASS** — `npm test -- tests/proposals/constants.test.ts`.

- [ ] **Step 5: Make the bucket public** — replace `scripts/setup-bucket.mts` with:

```ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);
const { data: existing } = await supabase.storage.getBucket("proposals");
if (existing) {
  if (existing.public) {
    console.log("bucket 'proposals' already public");
  } else {
    const { error } = await supabase.storage.updateBucket("proposals", { public: true });
    if (error) throw error;
    console.log("flipped bucket 'proposals' to public");
  }
} else {
  const { error } = await supabase.storage.createBucket("proposals", { public: true });
  if (error) throw error;
  console.log("created public bucket 'proposals'");
}
```

> This is an ops step. Run it against the live project (`tsx --env-file=.env.local scripts/setup-bucket.mts`) only if you have credentials; otherwise note in the report that the bucket must be flipped to public before deploy. The code in later tasks works regardless (it just builds URLs).

- [ ] **Step 6: Typecheck + format + commit**

```bash
npx tsc --noEmit
npx prettier --write src/shared/lib/proposals/constants.ts tests/proposals/constants.test.ts scripts/setup-bucket.mts
git add -A
git commit -m "feat: publicUrl helper + public proposals bucket (drop read-signing) (Stage 2a)"
```

---

### Task 2: Proposal detail DTO types in the entity + legacy bridge

**Files:**

- Modify: `src/entities/proposal/model/types.ts` (add page/variant/detail DTOs)
- Modify: `src/entities/proposal/index.ts` (export the new types)
- Modify: `src/legacy/lib/preview/types.ts` (re-export `PreviewPage` from the entity)
- Modify: `src/legacy/lib/preview/load-variants.ts` (re-export `ViewerVariant`/`EditorVariant` from the entity; remove the local type defs)

> Canonicalize the DTO types in the entity so the entity loader (Task 3) and the client page (Task 4) share them without importing `@/legacy`. The legacy preview type files re-export the entity types, so the ~6 legacy preview/edit components that import `PreviewPage`/`EditorVariant`/`ViewerVariant` need **no** changes.

- [ ] **Step 1: Add DTO types** — append to `src/entities/proposal/model/types.ts`:

```ts
// A single rendered page: public read URL + native pixel dimensions + page order.
export type ProposalPage = {
  id: string;
  url: string;
  width: number;
  height: number;
  pageOrder: number;
};

// One 안(variant) with its current version's pages — the viewer shape.
export type ViewerVariant = {
  id: string;
  slug: string;
  label: string;
  currentVersionId: string | null;
  pages: ProposalPage[];
};

// Editor view also needs the per-variant version history.
export type EditorVariant = ViewerVariant & {
  versions: { id: string; versionNo: number; note: string | null }[];
};

// The proposal subset the editor detail view renders (no timestamps are shown).
export type ProposalDetailHeader = {
  id: string;
  title: string;
  publicId: string;
  visibility: string;
  hasPassword: boolean;
};

// Full editor detail payload returned by GET /api/proposals/[id].
export type ProposalDetail = {
  proposal: ProposalDetailHeader;
  variants: EditorVariant[];
};
```

> `ProposalPage` intentionally has the same shape as the legacy `PreviewPage` (incl. `pageOrder`).

- [ ] **Step 2: Export from the entity barrel** — in `src/entities/proposal/index.ts` add to the existing type export line:

```ts
export type {
  Proposal,
  ProposalPage,
  ViewerVariant,
  EditorVariant,
  ProposalDetailHeader,
  ProposalDetail,
} from "./model/types";
```

(Keep the existing `proposalQueries` and `fetchProposals` exports.)

- [ ] **Step 3: Bridge `PreviewPage`** — replace the whole body of `src/legacy/lib/preview/types.ts` with:

```ts
// PreviewPage is now the entity's ProposalPage (same shape). Re-exported here so
// legacy preview components keep their `@/legacy/lib/preview/types` import.
export type { ProposalPage as PreviewPage } from "@/entities/proposal";
```

- [ ] **Step 4: Bridge `ViewerVariant`/`EditorVariant`** — in `src/legacy/lib/preview/load-variants.ts`, DELETE the local `ViewerVariant` and `EditorVariant` type blocks (lines defining `export type ViewerVariant = {...}` and `export type EditorVariant = ...`) and the now-unused `PreviewPage` import, and add at the top:

```ts
import type { ViewerVariant, EditorVariant, ProposalPage } from "@/entities/proposal";
export type { ViewerVariant, EditorVariant } from "@/entities/proposal";
```

> `EditorVariant` MUST be in the local `import type` (not only the re-export): `loadEditorVariants` — kept in this module until Task 5 — references `EditorVariant` in-module (`Promise<EditorVariant[]>` and `Map<string, EditorVariant["versions"]>`). A bare `export … from` re-export creates NO local binding, so importing it locally AND re-exporting it is required for tsc to pass at this commit. (Importing and separately re-exporting the same name is legal and does not collide.)

Then update the function bodies to use `ProposalPage` where they referenced `PreviewPage` (the page object pushed in `loadVariantsForProposal`). The functions' logic is otherwise unchanged in this task (still using `createReadUrls` — replaced in Task 5).

> After this, `loadVariantsForProposal`/`loadEditorVariants` still compile and behave identically; only the type source moved.

- [ ] **Step 5: Typecheck** — `npx tsc --noEmit` → exit 0 (confirms every legacy importer of these types still resolves through the bridges).

- [ ] **Step 6: Format + commit**

```bash
npx prettier --write src/entities/proposal/model/types.ts src/entities/proposal/index.ts src/legacy/lib/preview/types.ts src/legacy/lib/preview/load-variants.ts
git add -A
git commit -m "refactor: canonicalize proposal detail DTO types in entity + bridge legacy (Stage 2a)"
```

---

### Task 3: Guarded `getProposalDetail` server fn + client fetcher + `proposalQueries.detail` + thin GET

**Files:**

- Create: `src/entities/proposal/api/get-proposal-detail.server.ts`
- Create: `src/entities/proposal/api/get-proposal-detail.ts`
- Modify: `src/entities/proposal/api/proposal.query.ts` (add `detail`)
- Modify: `src/entities/proposal/index.ts` (export the client fetcher)
- Modify: `app/api/proposals/[id]/route.ts` (GET → thin wrapper; leave PATCH/DELETE for Stage 2b)

> The server fn is self-contained (does not import `@/legacy`): it mirrors `loadEditorVariants` but is entity-owned, returns the `ProposalDetail` DTO, and builds `publicUrl` per page.

- [ ] **Step 1: Server fn** — `src/entities/proposal/api/get-proposal-detail.server.ts`

```ts
import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { publicUrl } from "@/shared/lib/proposals/constants";
import type { ProposalDetail, EditorVariant, ProposalPage } from "../model/types";

export async function getProposalDetail(id: string): Promise<ProposalDetail> {
  await requireEditor();

  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  const proposal = rows[0];
  if (!proposal) throw new Error("NOT_FOUND");

  const variants = await db
    .select()
    .from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id))
    .orderBy(asc(proposalVariants.sortOrder));

  const variantIds = variants.map((v) => v.id);
  const versions = variantIds.length
    ? await db
        .select()
        .from(proposalVersions)
        .where(inArray(proposalVersions.variantId, variantIds))
        .orderBy(asc(proposalVersions.versionNo))
    : [];

  const currentVersionIds = variants
    .map((v) => v.currentVersionId)
    .filter((vid): vid is string => vid !== null);
  const pages = currentVersionIds.length
    ? await db
        .select()
        .from(proposalPages)
        .where(inArray(proposalPages.versionId, currentVersionIds))
        .orderBy(asc(proposalPages.pageOrder))
    : [];

  const pagesByVersion = new Map<string, ProposalPage[]>();
  for (const pg of pages) {
    const list = pagesByVersion.get(pg.versionId) ?? [];
    list.push({
      id: pg.id,
      url: publicUrl(pg.storagePath),
      width: pg.width,
      height: pg.height,
      pageOrder: pg.pageOrder,
    });
    pagesByVersion.set(pg.versionId, list);
  }

  const versionsByVariant = new Map<string, EditorVariant["versions"]>();
  for (const ver of versions) {
    const list = versionsByVariant.get(ver.variantId) ?? [];
    list.push({ id: ver.id, versionNo: ver.versionNo, note: ver.note });
    versionsByVariant.set(ver.variantId, list);
  }

  const editorVariants: EditorVariant[] = variants.map((v) => ({
    id: v.id,
    slug: v.slug,
    label: v.label,
    currentVersionId: v.currentVersionId,
    pages: v.currentVersionId ? (pagesByVersion.get(v.currentVersionId) ?? []) : [],
    versions: versionsByVariant.get(v.id) ?? [],
  }));

  return {
    proposal: {
      id: proposal.id,
      title: proposal.title,
      publicId: proposal.publicId,
      visibility: proposal.visibility,
      hasPassword: !!proposal.accessPasswordHash,
    },
    variants: editorVariants,
  };
}
```

> `throw new Error("NOT_FOUND")` → `toErrorResponse` maps it to 404 (already in `STATUS_BY_CODE`).

- [ ] **Step 2: Client fetcher** — `src/entities/proposal/api/get-proposal-detail.ts`

```ts
import { http } from "@/shared/api/http";
import type { ProposalDetail } from "../model/types";

export function getProposalDetail(id: string): Promise<ProposalDetail> {
  return http<ProposalDetail>(`/api/proposals/${id}`);
}
```

- [ ] **Step 3: Query factory** — add `detail` to `src/entities/proposal/api/proposal.query.ts`:

```ts
import { queryOptions } from "@tanstack/react-query";
import { getProposals } from "./get-proposals";
import { getProposalDetail } from "./get-proposal-detail";

export const proposalQueries = {
  all: () => ["proposals"] as const,
  lists: () => [...proposalQueries.all(), "list"] as const,
  list: () =>
    queryOptions({
      queryKey: proposalQueries.lists(),
      queryFn: getProposals,
    }),
  details: () => [...proposalQueries.all(), "detail"] as const,
  detail: (id: string) =>
    queryOptions({
      queryKey: [...proposalQueries.details(), id],
      queryFn: () => getProposalDetail(id),
    }),
};
```

- [ ] **Step 4: Export the client fetcher** — in `src/entities/proposal/index.ts` add:

```ts
export { getProposalDetail as fetchProposalDetail } from "./api/get-proposal-detail";
```

- [ ] **Step 5: Thin GET route** — in `app/api/proposals/[id]/route.ts`, replace ONLY the `GET` handler (leave `PATCH`/`DELETE` untouched — Stage 2b migrates them) with:

```ts
import { getProposalDetail } from "@/entities/proposal/api/get-proposal-detail.server";
import { toErrorResponse } from "@/shared/api/to-error-response";
// ...
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await getProposalDetail(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

Remove imports now unused by GET **only if** PATCH/DELETE don't use them (they still use `db`, `proposals`, `eq`, `requireEditor`, `hashPassword`, `removeObjects`, `NextResponse`, the version/variant tables — keep those). The GET previously used `asc`/`inArray`/`proposalVariants`/`proposalVersions` — keep any still referenced by PATCH/DELETE; drop only the truly-unused. Verify with `npx tsc --noEmit`.

- [ ] **Step 6: Typecheck + build** — `npx tsc --noEmit && npm run build` → PASS. (GET now returns the nested DTO; the legacy RSC detail page still works — it uses `loadEditorVariants`, not this route, until Task 4.)

- [ ] **Step 7: Format + commit**

```bash
npx prettier --write src/entities/proposal/api/get-proposal-detail.server.ts src/entities/proposal/api/get-proposal-detail.ts src/entities/proposal/api/proposal.query.ts src/entities/proposal/index.ts "app/api/proposals/[id]/route.ts"
git add -A
git commit -m "feat: guarded getProposalDetail + proposalQueries.detail + thin GET /api/proposals/[id] (Stage 2a)"
```

---

### Task 4: Flip detail page to client `src/pages/proposal-detail` + rewire legacy mutations to invalidate

**Files:**

- Create: `src/pages/proposal-detail/ui/proposal-detail-page.tsx`
- Create: `src/pages/proposal-detail/index.ts`
- Modify: `app/(dashboard)/dashboard/proposals/[id]/page.tsx` (local wrapper → client page)
- Modify: `src/legacy/components/proposals/proposal-settings.tsx` (refresh → invalidate)
- Modify: `src/legacy/components/proposals/variant-tabs.tsx` (refresh → invalidate)
- Modify: `src/legacy/components/proposals/add-variant-form.tsx` (refresh → invalidate)
- Modify: `src/legacy/components/proposals/add-version-form.tsx` (refresh → invalidate)
- Modify: `src/legacy/components/proposals/version-actions.tsx` (refresh → invalidate)

> **Atomic task:** the page becomes client-rendered AND every mutation component switches `router.refresh()` → `queryClient.invalidateQueries(proposalQueries.detail(id))` in the same commit, so edits keep updating the view. The legacy components stay otherwise as-is (raw `fetch`); their full `features/*` migration is Stage 2b/2c.

- [ ] **Step 1: Client detail page** — `src/pages/proposal-detail/ui/proposal-detail-page.tsx`

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { ProposalSettings } from "@/legacy/components/proposals/proposal-settings";
import { VariantTabs } from "@/legacy/components/proposals/variant-tabs";
import { ProposalEditorPreview } from "@/legacy/components/preview/proposal-editor-preview";

export function ProposalDetailPage({ proposalId }: { proposalId: string }) {
  const { data, isPending, isError } = useQuery(proposalQueries.detail(proposalId));

  if (isPending) return <p className="text-muted-foreground text-sm">불러오는 중…</p>;
  if (isError || !data)
    return <p className="text-destructive text-sm">시안을 불러오지 못했습니다.</p>;

  const { proposal, variants } = data;

  // Mirror the RSC page's `if (variants.length === 0) notFound()` guard: VariantTabs /
  // ProposalEditorPreview read `active.label` unconditionally and crash on an empty list.
  if (variants.length === 0) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{proposal.title}</h1>
        <p className="text-muted-foreground text-sm">표시할 안이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{proposal.title}</h1>
        <p className="text-muted-foreground mt-1 font-mono text-xs">/p/{proposal.publicId}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">설정</h2>
        <ProposalSettings
          proposalId={proposal.id}
          visibility={proposal.visibility}
          hasPassword={proposal.hasPassword}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">안</h2>
        <VariantTabs
          proposalId={proposal.id}
          variants={variants.map((v) => ({ id: v.id, label: v.label, slug: v.slug }))}
        />
      </section>

      <ProposalEditorPreview proposalId={proposal.id} variants={variants} />
    </div>
  );
}
```

`src/pages/proposal-detail/index.ts`:

```ts
export { ProposalDetailPage } from "./ui/proposal-detail-page";
```

- [ ] **Step 2: App route → local wrapper** — replace the entire contents of `app/(dashboard)/dashboard/proposals/[id]/page.tsx` with:

```tsx
import { ProposalDetailPage } from "@/pages/proposal-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProposalDetailPage proposalId={id} />;
}
```

> Mirrors the Stage 1b login route: the `app/` route owns the `params` Promise contract; the `src/pages` composition takes a plain `proposalId` prop.

- [ ] **Step 3: Rewire `proposal-settings.tsx`** — add imports and swap refreshes. Add near the top:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
```

Inside the component, after `const router = useRouter();` add:

```tsx
const queryClient = useQueryClient();
```

In `patch()`, replace `else router.refresh();` with:

```tsx
      else queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey });
```

In `onDelete()`, replace `if (res.ok) { router.push("/dashboard/proposals"); router.refresh(); }` with:

```tsx
if (res.ok) {
  queryClient.invalidateQueries({ queryKey: proposalQueries.lists() });
  router.push("/dashboard/proposals");
}
```

(Keep `useRouter`/`router` — still used for the post-delete navigation.)

- [ ] **Step 4: Rewire `variant-tabs.tsx`** — add the same two imports plus `const queryClient = useQueryClient();` after `const router = useRouter();`. Replace each `router.refresh();` (in `rename`, `move`, `remove`) with:

```tsx
queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey });
```

`router` becomes unused after this (no other `router.*` calls) — remove the `useRouter` import and the `const router = useRouter();` line. Verify with tsc/lint that `router` is gone.

- [ ] **Step 5: Rewire `add-variant-form.tsx`** — add the two imports + `const queryClient = useQueryClient();` after `const router = useRouter();`. Replace `router.refresh();` with:

```tsx
queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey });
```

`router` becomes unused — remove `useRouter` import + `const router`.

- [ ] **Step 6: Rewire `add-version-form.tsx`** — same as Step 5 (add imports + `queryClient`, replace `router.refresh();` with the invalidate, remove the now-unused `useRouter`/`router`).

- [ ] **Step 7: Rewire `version-actions.tsx`** (`RestoreButton`) — add the two imports + `const queryClient = useQueryClient();` after `const router = useRouter();`. Replace `if (res.ok) router.refresh();` with:

```tsx
if (res.ok)
  queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey });
```

`router` becomes unused — remove `useRouter`/`router`.

- [ ] **Step 8: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → PASS. The detail route renders client-side; `loadEditorVariants` is now unused (removed in Task 5).

- [ ] **Step 9: Manual smoke (if a session is available)** — `npm run dev`; as an editor open `/dashboard/proposals/<id>`: shows "불러오는 중…" then the proposal; switching variant tabs is instant; changing visibility/password, renaming/reordering/deleting a 안, adding a 안/버전, and restoring a version all reflect **without a full reload** (query invalidation). A bad id shows "시안을 불러오지 못했습니다.". Stop dev. If no Supabase env, rely on tsc+lint+build and say so.

- [ ] **Step 10: Format + commit**

```bash
npx prettier --write src/pages/proposal-detail "app/(dashboard)/dashboard/proposals/[id]/page.tsx" src/legacy/components/proposals/proposal-settings.tsx src/legacy/components/proposals/variant-tabs.tsx src/legacy/components/proposals/add-variant-form.tsx src/legacy/components/proposals/add-version-form.tsx src/legacy/components/proposals/version-actions.tsx
git add -A
git commit -m "feat: proposal detail page client-side via useQuery; legacy edits invalidate detail query (Stage 2a)"
```

---

### Task 5: Remove dead read-signing

**Files:**

- Modify: `src/legacy/lib/preview/load-variants.ts` (delete `loadEditorVariants`; switch `loadVariantsForProposal` to `publicUrl`)
- Modify: `src/shared/storage.ts` (remove `createReadUrl` + `createReadUrls`)

> After Task 4, `loadEditorVariants` is unused (the detail page reads via the entity). The only remaining read-signing user is `loadVariantsForProposal` (public viewer, Stage 4) — switch it to `publicUrl` so the public bucket serves it and the signing functions can be deleted.

- [ ] **Step 1: Switch `loadVariantsForProposal` to public URLs + drop the editor loader** — in `src/legacy/lib/preview/load-variants.ts`:
  - Remove `import { createReadUrls } from "@/shared/storage";` and add `import { publicUrl } from "@/shared/lib/proposals/constants";`.
  - Replace the signing line `const urlByPath = await createReadUrls(pages.map((p) => p.storagePath));` and the page mapping that used `urlByPath.get(pg.storagePath) ?? ""` with direct `publicUrl(pg.storagePath)`:

```ts
// Group pages by version (public URLs — no signing).
const pagesByVersion = new Map<string, ProposalPage[]>();
for (const pg of pages) {
  const list = pagesByVersion.get(pg.versionId) ?? [];
  list.push({
    id: pg.id,
    url: publicUrl(pg.storagePath),
    width: pg.width,
    height: pg.height,
    pageOrder: pg.pageOrder,
  });
  pagesByVersion.set(pg.versionId, list);
}
```

- DELETE the entire `loadEditorVariants` function (and the `proposalVersions` import / `inArray` if they become unused after the deletion — keep whatever `loadVariantsForProposal` still needs: `proposalVariants`, `proposalPages`, `asc`, `eq`, `inArray` for the pages query). Verify with tsc.
- Keep the `export type { ViewerVariant, EditorVariant } from "@/entities/proposal";` bridge line (Task 2) — `EditorVariant` is still imported by `proposal-editor-preview.tsx` from this module.
- Now that `loadEditorVariants` is gone, drop `EditorVariant` from the LOCAL `import type { ViewerVariant, EditorVariant, ProposalPage } from "@/entities/proposal";` (it was only used in-module by `loadEditorVariants`) → `import type { ViewerVariant, ProposalPage } from "@/entities/proposal";`. Keep `ViewerVariant` + `ProposalPage` (still used by `loadVariantsForProposal`) and keep the re-export line above. (Leaving the unused local import is only a lint _warning_, but tidy it.)

- [ ] **Step 2: Remove the signing helpers** — in `src/shared/storage.ts` delete the `createReadUrl` and `createReadUrls` functions (keep `createUploadUrl`, `removeObjects`, `listObjectNames`).

- [ ] **Step 3: Guard — nothing references the removed signers** —

```bash
grep -rn "createReadUrl" app src   # expect NO output
```

- [ ] **Step 4: Typecheck + build** — `npx tsc --noEmit && npm run build` → PASS (public viewer still compiles; it now renders public URLs).

- [ ] **Step 5: Format + commit**

```bash
npx prettier --write src/legacy/lib/preview/load-variants.ts src/shared/storage.ts
git add -A
git commit -m "refactor: drop read-signing (createReadUrl/s); loadVariantsForProposal uses publicUrl (Stage 2a)"
```

---

### Task 6: Stage 2a verification gate + handoff update

**Files:** `docs/superpowers/HANDOFF.md` (the rest is verification only)

- [ ] **Step 1: Full green gate** — Node ≥22: `npx tsc --noEmit && npm run lint && npm test && npm run build` → all PASS. Report the test delta (+1 `publicUrl`) and confirm the route table is unchanged in count (`GET /api/proposals/[id]` still exists, now returning the DTO). Read actual counts from output; don't assert hardcoded absolutes.

- [ ] **Step 2: No-SSR check** — the detail page must not fetch data on the server:

```bash
grep -rn "loadEditorVariants\|@/shared/db\|@drizzle/schema\|@/shared/storage\"" src/pages/proposal-detail
```

Expected: NO output. Also confirm `app/(dashboard)/dashboard/proposals/[id]/page.tsx` only `await params` + renders the client page (no `db`/`loadEditorVariants`).

- [ ] **Step 3: FSD layering + barrel safety**

```bash
grep -rn "@/features/\|@/widgets/\|@/pages/" src/entities src/shared          # expect empty
grep -rn "@/legacy" src/entities/proposal                                     # expect empty (entity NEVER imports legacy)
grep -rn "@/legacy/lib" src/pages/proposal-detail                             # expect empty (page may use legacy COMPONENTS, never legacy data/loaders)
grep -rn "\.server\"" src/entities/proposal/index.ts                          # expect empty (no server fn in barrel)
```

All expected empty. Note: `src/pages/proposal-detail` intentionally imports the three legacy **components** (`ProposalSettings`, `VariantTabs`, `ProposalEditorPreview` from `@/legacy/components/...`) as a temporary composition until Stage 2b/2c promote them to `features/*` — so a blanket `@/legacy` grep on the page is expected to match those three lines and is NOT a failure; only `@/legacy/lib` (data/loaders) in the page is forbidden.

- [ ] **Step 4: server-only safety** — no `"use client"` module reaches a server module:

```bash
grep -rln "use client" src/pages/proposal-detail | xargs grep -l "\.server\"\|@/shared/db\|@/shared/storage\"\|@/shared/supabase/service" 2>/dev/null
```

Expected: NO output. (The client page imports only `@/entities/proposal` barrel + legacy client components.)

- [ ] **Step 5: read-signing is gone**

```bash
grep -rn "createReadUrl" app src     # expect empty
grep -rn "createSignedUrl\b" src/shared/storage.ts   # expect empty (only createSignedUploadUrl remains)
```

- [ ] **Step 6: Update the handoff** — in `docs/superpowers/HANDOFF.md`: under "Done so far" add a **Stage 2a** entry (detail read client-side via `proposalQueries.detail` + thin `GET /api/proposals/[id]`; **images now public — read-signing dropped**, `publicUrl` helper, bucket `public: true`; legacy edit components kept but invalidate the detail query). In "Carry-forwards"/"Next steps": remove the "guarded editor-images GET" item (superseded by the public-bucket decision — note this explicitly) and the public-viewer signing note (Stage 4 now uses `publicUrl`); set next to **Stage 2b** (detail edit mutations → `features/*`: settings/visibility/password/delete, variant rename/reorder/delete, version restore — thin routes + Zod) then **Stage 2c** (add-variant/add-version upload forms → `features/*` + thin routes; delete legacy proposal-detail components). Note the bucket-public ops step must be applied on each environment. Commit:

```bash
npx prettier --write docs/superpowers/HANDOFF.md
git add docs/superpowers/HANDOFF.md
git commit -m "docs: handoff — Stage 2a done (detail read client-side, public images), next = Stage 2b"
```

---

## Self-Review (completed by author)

- **Spec/handoff coverage:** detail read moved client-side via `proposalQueries.detail` + thin guarded `GET /api/proposals/[id]` (Tasks 3–4); SSR detail fetch removed (Task 4); image read-signing dropped for public URLs (Tasks 1, 3, 5) — supersedes the spec's "guarded editor-images GET"; DTO types centralized in the entity with legacy bridges (Task 2); legacy edits kept working via query invalidation (Task 4); verification incl. no-SSR/FSD/server-only/no-signing gates + handoff (Task 6).
- **Decomposition:** Stage 2b (detail edit mutations) and 2c (upload forms) are deferred with explicit scope; 2a leaves the legacy edit components functional (raw fetch + invalidate) as a working intermediate.
- **Green-at-every-commit:** Task 2 moves types behind re-export bridges (no importer breaks); Task 3 changes the GET shape but only Task 4's client page consumes it (the legacy RSC page still uses `loadEditorVariants` until Task 4); Task 4 flips the page AND rewires all mutation components atomically; Task 5 removes `loadEditorVariants`/signers only after Task 4 stops using them and `loadVariantsForProposal` switches to `publicUrl`.
- **No-placeholder scan:** all code/commands concrete. Edits to existing files show the exact old→new snippet; new files are complete.
- **Type consistency:** `ProposalDetail`/`EditorVariant`/`ProposalPage` (Task 2) consumed by `getProposalDetail` server fn + client fetcher (Task 3) and the client page (Task 4); `publicUrl` (Task 1) consumed by the server loader (Task 3) and `loadVariantsForProposal` (Task 5); `proposalQueries.detail` (Task 3) consumed by the page (Task 4) and the invalidations (Task 4); legacy `PreviewPage`/`EditorVariant` resolve through the entity bridges (Task 2).
- **Known edges / accepted:** images are world-readable by URL (visibility/password protect the page, not the bytes) — the user-approved tradeoff; the bucket-public flip is an ops step that must run per environment; `GET /api/proposals/[id]` response shape changed (only the detail page consumes it).

**Adversarial audit (4 lenses: FSD-types / ordering-green / Next16-RQ / behavior-security; high+ findings independently refute-verified):**

- Fixed (high): the Task 6 `@/legacy` gate was unpassable because the client page composes three legacy components — narrowed the gate to `src/entities/proposal` (entity never imports legacy) + a page gate that forbids only `@/legacy/lib` (data) while permitting `@/legacy/components`; amended the FSD Global Constraint to allow the page's temporary legacy-component composition.
- Fixed (high): Task 2's `EditorVariant` re-export-only would break tsc (the still-present `loadEditorVariants` references it in-module) — added `EditorVariant` to the local `import type`, with Task 5 dropping it when `loadEditorVariants` is deleted.
- Fixed (medium, flagged by 2 lenses): Task 4 dropped the RSC's `variants.length === 0 → notFound()` guard, which would crash `VariantTabs` (`active.label` on `undefined`) — added an empty-variants guard in the client page + documented the divergence.
- Fixed (low): Task 1 test now merges into the existing `constants` import (avoids `import/no-duplicates`); barrel gate regex tightened to `\.server"`.
- Refuted (correctly, no change): "unused `asc`/`inArray` imports break lint" and "task gates omit lint" — `@typescript-eslint/no-unused-vars` is `warn` (lint exits 0), so no commit goes red; Task 6 runs the full lint gate regardless.

## Next: Stage 2b, then 2c

- **2b:** migrate the detail **edit** mutations to `features/*` with RHF/Zod (where forms) + `useMutation` + thin `*.server.ts` routes (`PATCH`/`DELETE /api/proposals/[id]`, variant `PATCH`/`DELETE`, version `restore`), replacing the raw-fetch legacy components rewired in 2a.
- **2c:** migrate `add-variant`/`add-version` upload forms to `features/*` (reusing `shared/storage-client`), make the variant/version/pages `POST` routes thin (`*.server.ts` + Zod + `toErrorResponse`), and delete the legacy proposal-detail components + the `loadVariantsForProposal` bridge once the public viewer (Stage 4) no longer needs it.
