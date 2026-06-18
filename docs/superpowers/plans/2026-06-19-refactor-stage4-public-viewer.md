# Refactor Stage 4 — Public Viewer: Access + Variant-Content Read → FSD

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate the public viewer's **access gate** and **variant-content read** onto the new architecture: promote the access helpers out of `src/legacy` (HMAC unlock token → `shared/access`, `resolveViewerGate` → `entities/proposal`, unlock action → `features/unlock-access`), add a guarded `GET /api/p/[publicId]/variants`, and flip the viewer page's variant data from SSR to a client `useQuery`. The page keeps its server-side gate branches (forbidden / need-password); the **realtime / pins / chat / preview-UI cluster stays in `src/legacy` and keeps working untouched** (it is migrated as one unit in Stage 5).

**Architecture:** Read flows client `src/pages/public-viewer` → `useQuery(proposalQueries.viewerVariants(publicId))` → `GET /api/p/[publicId]/variants` → guarded `getViewerVariants(publicId)` (`resolveViewerGate` → `allow` else 403/404 → load variants with `publicUrl`) → `toErrorResponse`. The app `page.tsx` stays a server component: `resolveViewerGate` decides `notFound` / forbidden UI / need-password form (server action `unlock` from `features/unlock-access`) / `allow` → renders the client `<PublicViewerPage>`. The `layout.tsx` server gate + `RealtimeShell` are unchanged (Stage 5). The client page renders the **legacy** `<PublicViewer>` tree (page → legacy is the allowed temporary exception, as for the editor detail page).

**Scope (user-approved — Option A, spec-aligned):** access + variant read only. The preview components (`proposal-preview`/`fullscreen-slides`/`canvas-view`), pins (`pin-layer`/`use-pins`), cursors, chat, and `realtime-provider`/`RealtimeShell` are **one realtime-coupled cluster** kept in `src/legacy` and relocated together in **Stage 5**. This stage must NOT break the live realtime/pins/chat.

**Tech Stack:** Next.js 16 (App Router, Route Handlers, server actions for unlock), React 19, `@tanstack/react-query` v5, Drizzle, Supabase, Vitest (node env).

**Source spec:** `docs/superpowers/specs/2026-06-17-fsd-react-query-refactor-design.md` (Stage 4, lines ~219-224). **Handoff:** `docs/superpowers/HANDOFF.md`. Builds on Stage 0/1/1b/2/3 (merged): `entities/proposal` (slice pattern + `ViewerVariant`/`ProposalPage` DTO types + `publicUrl` reads), `shared/api/{http,to-error-response}`, `shared/auth/guards.server`, `shared/lib/proposals/access` (`decideAccess` — already shared), `shared/lib/password` (`verifyPassword` — already shared).

## Global Constraints

- **Node ≥22** (engines; `next build` needs it). Already active on the dev machine (v22.18.0 via nvm) — do not switch Node.
- **FSD layer order:** `shared < entities < features < pages < app`. `entities`/`features` must **not** import `@/legacy`. The page `src/pages/public-viewer` may temporarily import the legacy `<PublicViewer>` UI (the realtime/pins cluster) — the documented exception until Stage 5; it must never import legacy _data/loaders_ (`@/legacy/lib/...`). Legacy may import `@/entities`/`@/shared`/`@/features`. Entity/feature barrels export only client-safe modules (never a `server-only` `*.server.ts`) — **carve-out:** a feature barrel MAY re-export a `"use server"` **Server Action** (e.g. `features/unlock-access` exporting `unlock`), which is client-callable by design and is the feature's public API. (Task 6's barrel `.server` grep targets the entity barrel only.)
- **Access gate stays server-side (security):** `resolveViewerGate` runs only on the server (cookies + HMAC + `getProfile` + DB). The new `GET /api/p/[publicId]/variants` re-checks the gate and returns **403 with no content** when `decision !== "allow"`. The unlock token is HMAC-signed server-side; the secret (`ACCESS_TOKEN_SECRET`) never reaches the client. The `httpOnly` unlock cookie + `path:"/"` behavior is preserved exactly.
- **Do NOT break realtime:** `layout.tsx` (the `RealtimeShell` + gate) and the entire legacy preview/pins/chat/realtime tree are unchanged except for repointing the `resolveViewerGate` import. The client viewer page passes `variants` + `publicId` + `viewer` to the legacy `<PublicViewer>` exactly as the SSR page did.
- **TDD (red-green) for PURE logic only:** the relocated `unlock-token` HMAC helpers keep their existing unit test (moved, not rewritten). Integration code (server fns, route handler, server action, client page) has no unit tests in this repo's style — verify via `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, plus grep gates. State honestly per task.
- **One commit per task.** Prettier-format touched/new files before committing. `format:check` stays globally red on not-yet-migrated `src/legacy` + `app/`.
- **Green at every commit.** Each promotion repoints ALL importers in the same task; the page flip + the `load-variants.ts` delete happen together (Task 5).

### Documented behavior divergences (intended)

- Viewer **variant content** is fetched client-side (brief loading state) via the guarded GET instead of SSR. The access decision (forbidden / need-password / allow) + the unlock flow stay server-side and unchanged.
- `getViewerVariants` throws `NOT_FOUND` (404) for an unknown `publicId` and `FORBIDDEN` (403) when the gate is not `allow` — the GET returns no content in those cases (the server page's own branches still render the friendly forbidden/password UI for direct navigations; the GET guard is the API backstop).
- `unlock` stays a **server action** (progressive-enhancement form), relocated to `features/unlock-access` — a deliberate carve-out from the Stage 1b route-handler auth decision, per the spec ("각 action 자체 가드"). Its behavior (verify password → sign token → set `httpOnly` cookie → redirect) is preserved exactly.
- The route-level `loading.tsx` (variant-grid skeleton) now covers only the **server gate resolution** (fast), since variant content loads client-side; on `allow` the user briefly sees that skeleton then the client page's "불러오는 중…". Accepted minor flash; the `loading.tsx` comment is updated to reflect this (Task 5 Step 4).

---

### Task 1: Promote the unlock-token (HMAC cookie) helpers → `shared/access`

**Files:**

- Move: `src/legacy/lib/access/cookie.ts` → `src/shared/access/unlock-token.ts`
- Move: `tests/access/cookie.test.ts` → `tests/shared/access/unlock-token.test.ts` (repoint import)
- Modify: `src/legacy/lib/access/viewer-gate.ts` (repoint import — still legacy, moved in Task 2)
- Modify: `app/p/[publicId]/actions.ts` (repoint import — still legacy, moved in Task 4)

> `cookie.ts` is pure `node:crypto` (sign/verify HMAC + cookie name) and is unit-tested directly, so it does NOT get `import "server-only"` (that would break the node test) — it becomes a shared helper like `safe-redirect.ts`/`password.ts`. Body unchanged; this is a move + import repoint.

- [ ] **Step 1: Move the module + test**

```bash
mkdir -p src/shared/access tests/shared/access
git mv src/legacy/lib/access/cookie.ts src/shared/access/unlock-token.ts
git mv tests/access/cookie.test.ts tests/shared/access/unlock-token.test.ts
```

- [ ] **Step 2: Repoint the test import** — in `tests/shared/access/unlock-token.test.ts` change the import to `@/shared/access/unlock-token` (the exported names `signUnlockToken`/`verifyUnlockToken`/`unlockCookieName`/`UNLOCK_TTL_SECONDS` are unchanged).

- [ ] **Step 3: Repoint the two live importers** — grep + repoint to `@/shared/access/unlock-token`:

```bash
grep -rn "legacy/lib/access/cookie" app src   # find importers
```

Repoint `src/legacy/lib/access/viewer-gate.ts` (imports `verifyUnlockToken, unlockCookieName`) and `app/p/[publicId]/actions.ts` (imports `signUnlockToken, unlockCookieName, UNLOCK_TTL_SECONDS`) to `@/shared/access/unlock-token`. Then confirm:

```bash
grep -rn "legacy/lib/access/cookie" app src tests   # expect NO output
```

- [ ] **Step 4: Run the moved test + typecheck** — `npm test -- tests/shared/access/unlock-token.test.ts` (passes) and `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Format + commit**

```bash
npx prettier --write src/shared/access/unlock-token.ts tests/shared/access/unlock-token.test.ts src/legacy/lib/access/viewer-gate.ts "app/p/[publicId]/actions.ts"
git add -A
git commit -m "refactor: promote unlock-token (HMAC cookie) helpers to shared/access (Stage 4)"
```

---

### Task 2: Promote `resolveViewerGate` → `entities/proposal`

**Files:**

- Create: `src/entities/proposal/api/resolve-viewer-gate.server.ts`
- Modify: `src/entities/proposal/model/types.ts` (add `ViewerGate` type)
- Modify: `app/p/[publicId]/layout.tsx` (repoint import)
- Modify: `app/p/[publicId]/page.tsx` (repoint import)
- Modify: `app/api/p/[publicId]/pins/route.ts`, `app/api/p/[publicId]/pins/[pinId]/route.ts`, `app/api/p/[publicId]/chat/route.ts` (repoint import — Stage-5 routes, mechanical)
- Delete: `src/legacy/lib/access/viewer-gate.ts`

> `resolveViewerGate` is a server-only proposal-access read. After Task 1 it imports only `@/shared/*` + `@drizzle/*` (no legacy), so it can live in the entity. The `ViewerGate` type moves to the entity model.

- [ ] **Step 1: Add the `ViewerGate` type** — append to `src/entities/proposal/model/types.ts`:

```ts
import type { Proposal } from "@drizzle/schema";
import type { AccessDecision } from "@/shared/lib/proposals/access";

export type ViewerGate = {
  proposal: Proposal | null;
  decision: AccessDecision;
  editorName: string | null;
  viewer: { id: string; displayName: string | null } | null;
};
```

(If `Proposal` is already imported/re-exported in this file, reuse it — check first; avoid a duplicate import.)

- [ ] **Step 2: Create the server fn** — `src/entities/proposal/api/resolve-viewer-gate.server.ts` (move the body from the legacy file verbatim, with imports repointed):

```ts
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals } from "@drizzle/schema";
import { getProfile } from "@/shared/auth/guards.server";
import { isEditor, type Role } from "@/shared/auth/roles";
import { decideAccess } from "@/shared/lib/proposals/access";
import { verifyUnlockToken, unlockCookieName } from "@/shared/access/unlock-token";
import type { ViewerGate } from "../model/types";

// Single source of truth for public-viewer access, shared by the layout (to gate the
// realtime shell) and the page (to gate content). React.cache() dedupes within a request.
export const resolveViewerGate = cache(async (publicId: string): Promise<ViewerGate> => {
  const rows = await db.select().from(proposals).where(eq(proposals.publicId, publicId)).limit(1);
  const proposal = rows[0] ?? null;
  if (!proposal) return { proposal: null, decision: "forbidden", editorName: null, viewer: null };

  const profile = await getProfile();
  const editor = isEditor(profile?.role as Role | undefined);

  const cookieStore = await cookies();
  const token = cookieStore.get(unlockCookieName(publicId))?.value ?? "";
  const nowSec = Math.floor(Date.now() / 1000);
  const hasValidUnlock =
    !!token && verifyUnlockToken(token, publicId, nowSec, process.env.ACCESS_TOKEN_SECRET!);

  const decision = decideAccess({
    visibility: proposal.visibility,
    hasPassword: !!proposal.accessPasswordHash,
    isEditor: editor,
    hasValidUnlock,
  });

  const viewer = profile ? { id: profile.id, displayName: profile.displayName } : null;
  return { proposal, decision, editorName: editor ? (profile?.displayName ?? null) : null, viewer };
});
```

- [ ] **Step 3: Repoint all importers** — change `@/legacy/lib/access/viewer-gate` → `@/entities/proposal/api/resolve-viewer-gate.server` in: `app/p/[publicId]/layout.tsx`, `app/p/[publicId]/page.tsx`, `app/api/p/[publicId]/pins/route.ts`, `app/api/p/[publicId]/pins/[pinId]/route.ts`, `app/api/p/[publicId]/chat/route.ts`. Grep to find them all first:

```bash
grep -rn "legacy/lib/access/viewer-gate" app src   # repoint every hit
```

> `ViewerGate` is also imported as a TYPE by the realtime/pins legacy code? Grep `ViewerGate` — if any legacy file imports the type from the old path, repoint it to `@/entities/proposal`.

- [ ] **Step 4: Delete the legacy file + guard**

```bash
git rm src/legacy/lib/access/viewer-gate.ts
grep -rn "legacy/lib/access/viewer-gate" app src tests   # expect NO output
```

- [ ] **Step 5: Typecheck + build** — `npx tsc --noEmit && npm run build` → PASS. (The entity must not import legacy: `grep -rn "@/legacy" src/entities/proposal/api/resolve-viewer-gate.server.ts` → empty.)

- [ ] **Step 6: Format + commit**

```bash
npx prettier --write src/entities/proposal/api/resolve-viewer-gate.server.ts src/entities/proposal/model/types.ts "app/p/[publicId]/layout.tsx" "app/p/[publicId]/page.tsx" "app/api/p/[publicId]/pins/route.ts" "app/api/p/[publicId]/pins/[pinId]/route.ts" "app/api/p/[publicId]/chat/route.ts"
git add -A
git commit -m "refactor: promote resolveViewerGate to entities/proposal (Stage 4)"
```

---

### Task 3: `getViewerVariants` guarded read + `proposalQueries.viewerVariants` + thin `GET /api/p/[publicId]/variants`

**Files:**

- Create: `src/entities/proposal/api/get-viewer-variants.server.ts`
- Create: `src/entities/proposal/api/get-viewer-variants.ts` (client fetcher)
- Modify: `src/entities/proposal/api/proposal.query.ts` (add `viewerVariants`)
- Modify: `src/entities/proposal/index.ts` (export the client fetcher)
- Create: `app/api/p/[publicId]/variants/route.ts`

> `getViewerVariants(publicId)` does the gate + loads the variants in one guarded read (so the route is thin and the gate is enforced server-side). It inlines the variant/pages query with `publicUrl` (the entity can't import the legacy `loadVariantsForProposal`); the legacy loader is removed in Task 5.

- [ ] **Step 1: Server fn** — `src/entities/proposal/api/get-viewer-variants.server.ts`

```ts
import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalVariants, proposalPages } from "@drizzle/schema";
import { publicUrl } from "@/shared/lib/proposals/constants";
import { resolveViewerGate } from "./resolve-viewer-gate.server";
import type { ViewerVariant, ProposalPage } from "../model/types";

export async function getViewerVariants(publicId: string): Promise<ViewerVariant[]> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");

  const variants = await db
    .select()
    .from(proposalVariants)
    .where(eq(proposalVariants.proposalId, proposal.id))
    .orderBy(asc(proposalVariants.sortOrder));

  const currentVersionIds = variants
    .map((v) => v.currentVersionId)
    .filter((id): id is string => id !== null);
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

  return variants.map((v) => ({
    id: v.id,
    slug: v.slug,
    label: v.label,
    currentVersionId: v.currentVersionId,
    pages: v.currentVersionId ? (pagesByVersion.get(v.currentVersionId) ?? []) : [],
  }));
}
```

> Mirrors the editor `getProposalDetail` load (Stage 2a) but viewer-shaped (`ViewerVariant` = no `versions`). The gate is enforced first (FORBIDDEN/NOT_FOUND), then the read.

- [ ] **Step 2: Client fetcher** — `src/entities/proposal/api/get-viewer-variants.ts`

```ts
import { http } from "@/shared/api/http";
import type { ViewerVariant } from "../model/types";

export function getViewerVariants(publicId: string): Promise<ViewerVariant[]> {
  return http<ViewerVariant[]>(`/api/p/${publicId}/variants`);
}
```

- [ ] **Step 3: Query factory** — add `viewerVariants` to `src/entities/proposal/api/proposal.query.ts`:

```ts
import { getViewerVariants } from "./get-viewer-variants";
// ... inside proposalQueries:
  viewerVariants: (publicId: string) =>
    queryOptions({
      queryKey: [...proposalQueries.all(), "viewer-variants", publicId],
      queryFn: () => getViewerVariants(publicId),
    }),
```

(Keep the existing `all`/`lists`/`list`/`details`/`detail` entries.)

- [ ] **Step 4: Export the client fetcher** — in `src/entities/proposal/index.ts` add:

```ts
export { getViewerVariants as fetchViewerVariants } from "./api/get-viewer-variants";
```

- [ ] **Step 5: Thin GET route** — `app/api/p/[publicId]/variants/route.ts`

```ts
import { getViewerVariants } from "@/entities/proposal/api/get-viewer-variants.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET(_req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    return Response.json(await getViewerVariants(publicId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 6: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → PASS (the new route appears; the page still SSR-loads via legacy `loadVariantsForProposal` — unchanged until Task 5).

- [ ] **Step 7: Format + commit**

```bash
npx prettier --write src/entities/proposal/api/get-viewer-variants.server.ts src/entities/proposal/api/get-viewer-variants.ts src/entities/proposal/api/proposal.query.ts src/entities/proposal/index.ts "app/api/p/[publicId]/variants/route.ts"
git add -A
git commit -m "feat: getViewerVariants guarded read + proposalQueries.viewerVariants + thin GET /api/p/[publicId]/variants (Stage 4)"
```

---

### Task 4: `features/unlock-access` — relocate the unlock server action

**Files:**

- Create: `src/features/unlock-access/api/unlock.ts`
- Create: `src/features/unlock-access/index.ts`
- Modify: `app/p/[publicId]/page.tsx` (repoint the `unlock` import)
- Delete: `app/p/[publicId]/actions.ts`

> Keep `unlock` a server action (`"use server"`) — progressive-enhancement form, per the spec. Move it out of the route folder into the feature, self-guarded (re-fetches the proposal + verifies the password). Behavior unchanged. **Filename note:** name it `unlock.ts`, NOT `unlock.server.ts` — in this repo `*.server.ts` means **server-only** (every such file starts with `import "server-only"`, which THROWS if it reaches a client bundle). A `"use server"` Server Action is the opposite — it is **client-callable by design**. Using the `.server.ts` suffix here would invite a future "add `server-only` to match the others" edit that would break the action.

- [ ] **Step 1: Server action** — `src/features/unlock-access/api/unlock.ts`

```ts
"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals } from "@drizzle/schema";
import { verifyPassword } from "@/shared/lib/password";
import {
  signUnlockToken,
  unlockCookieName,
  UNLOCK_TTL_SECONDS,
} from "@/shared/access/unlock-token";

export async function unlock(publicId: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const rows = await db.select().from(proposals).where(eq(proposals.publicId, publicId)).limit(1);
  const proposal = rows[0];
  if (!proposal || proposal.visibility !== "public" || !proposal.accessPasswordHash) {
    redirect(`/p/${publicId}`);
  }
  if (!verifyPassword(password, proposal.accessPasswordHash)) {
    redirect(`/p/${publicId}?error=1`);
  }
  const exp = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SECONDS;
  const token = signUnlockToken(publicId, exp, process.env.ACCESS_TOKEN_SECRET!);
  const store = await cookies();
  store.set(unlockCookieName(publicId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: UNLOCK_TTL_SECONDS,
  });
  redirect(`/p/${publicId}`);
}
```

`src/features/unlock-access/index.ts`:

```ts
export { unlock } from "./api/unlock";
```

> A `"use server"` action re-exported through a barrel is fine — it's callable from a server component's `<form action>`. The barrel intentionally exports a Server Action (the feature's public API), which is the documented carve-out to the "barrels export only client-safe modules" constraint (a Server Action is client-callable, not a server-only module).

- [ ] **Step 2: Repoint the page import** — in `app/p/[publicId]/page.tsx` change `import { unlock } from "./actions";` → `import { unlock } from "@/features/unlock-access";`.

- [ ] **Step 3: Delete the legacy action + guard**

```bash
git rm "app/p/[publicId]/actions.ts"
grep -rn "from \"./actions\"\|p/\[publicId\]/actions" app src   # expect NO output
```

- [ ] **Step 4: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → PASS. The need-password form still posts to `unlock` (now from the feature); the unlock flow is unchanged.

- [ ] **Step 5: Format + commit**

```bash
npx prettier --write src/features/unlock-access "app/p/[publicId]/page.tsx"
git add -A
git commit -m "feat: features/unlock-access (relocate unlock server action); drop app actions.ts (Stage 4)"
```

---

### Task 5: Flip the viewer page — client `src/pages/public-viewer` + remove the legacy variant loader

**Files:**

- Create: `src/pages/public-viewer/ui/public-viewer-page.tsx`
- Create: `src/pages/public-viewer/index.ts`
- Modify: `app/p/[publicId]/page.tsx` (allow branch → client page; drop the SSR variant load)
- Modify: `src/legacy/components/preview/public-viewer.tsx` (repoint `ViewerVariant` import to the entity)
- Modify: `src/legacy/components/preview/proposal-editor-preview.tsx` (repoint `EditorVariant` import to the entity — it's the OTHER importer of the legacy loader bridge)
- Modify: `app/p/[publicId]/loading.tsx` (drop the now-stale `loadVariantsForProposal` comment reference)
- Delete: `src/legacy/lib/preview/load-variants.ts`

> The page's gate branches (notFound / forbidden / need-password) stay server-side. Only the `allow` branch changes: instead of `await loadVariantsForProposal` + `<PublicViewer>`, it renders the client `<PublicViewerPage>` which `useQuery`s the variants. The legacy `<PublicViewer>` tree (preview/pins/realtime) is unchanged — the client page just feeds it the fetched `variants`.

- [ ] **Step 1: Client page** — `src/pages/public-viewer/ui/public-viewer-page.tsx`

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { PublicViewer } from "@/legacy/components/preview/public-viewer";

export function PublicViewerPage({
  publicId,
  viewer,
}: {
  publicId: string;
  viewer: { id: string } | null;
}) {
  const { data: variants, isPending, isError } = useQuery(proposalQueries.viewerVariants(publicId));

  if (isPending) return <p className="text-muted-foreground p-6 text-sm">불러오는 중…</p>;
  if (isError || !variants)
    return <p className="text-destructive p-6 text-sm">시안을 불러오지 못했습니다.</p>;

  return <PublicViewer variants={variants} publicId={publicId} viewer={viewer} />;
}
```

`src/pages/public-viewer/index.ts`:

```ts
export { PublicViewerPage } from "./ui/public-viewer-page";
```

> This page imports the legacy `<PublicViewer>` (the realtime/pins cluster) — the documented temporary exception (page → `@/legacy/components`, never `@/legacy/lib`). `<PublicViewer>`'s `viewer` prop is `{ id: string } | null`; the gate's `viewer` is `{ id, displayName } | null` — pass `{ id: gate.viewer.id }` (or the whole object; `PublicViewer` only reads `.id`).

- [ ] **Step 2: Flip the page's allow branch** — in `app/p/[publicId]/page.tsx`: remove `import { loadVariantsForProposal } from "@/legacy/lib/preview/load-variants";` and `import { PublicViewer } from "@/legacy/components/preview/public-viewer";`; add `import { PublicViewerPage } from "@/pages/public-viewer";`. Replace the `allow` tail (currently `const variants = await loadVariantsForProposal(proposal.id); return <PublicViewer variants={variants} publicId={publicId} viewer={viewer} />;`) with:

```tsx
// decision === "allow": content is fetched client-side via React Query (guarded GET).
return <PublicViewerPage publicId={publicId} viewer={viewer ? { id: viewer.id } : null} />;
```

(The `notFound` / forbidden / need-password branches above are unchanged.)

- [ ] **Step 3: Repoint ALL importers of the legacy loader bridge** — the loader module re-exports BOTH `ViewerVariant` AND `EditorVariant` from the entity (Stage 2a bridge), and there are **two** type importers (plus the page's `loadVariantsForProposal`, handled in Step 2). Drive the repoint off the module path (not a symbol filter):

```bash
grep -rn "legacy/lib/preview/load-variants" src app   # the full importer set
```

Repoint each to `@/entities/proposal`:

- `src/legacy/components/preview/public-viewer.tsx` — `import type { ViewerVariant } from "@/entities/proposal";`
- `src/legacy/components/preview/proposal-editor-preview.tsx` (line 4, still live via the editor detail page) — `import type { EditorVariant } from "@/entities/proposal";`
  (Both types are already exported from `src/entities/proposal/index.ts`. legacy → entity is allowed.)

- [ ] **Step 4: Fix the stale comment in `loading.tsx`** — `app/p/[publicId]/loading.tsx` has a comment referencing `loadVariantsForProposal` (the SSR signing that no longer happens). Update it to say the route skeleton now covers only the server gate resolution (variant content loads client-side). This also keeps Step 5's guard grep a true NO-output check (the grep is not import-scoped and would otherwise match the comment).

- [ ] **Step 5: Delete the legacy variant loader + guard**

```bash
git rm src/legacy/lib/preview/load-variants.ts
grep -rn "legacy/lib/preview/load-variants\|loadVariantsForProposal" app src   # expect NO output (Step 4 removed the loading.tsx comment hit)
```

- [ ] **Step 6: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → PASS.

- [ ] **Step 7: Manual smoke (if a session + ACCESS_TOKEN_SECRET available)** — `npm run dev`:
  1. Public proposal (no password): `/p/<publicId>` shows "불러오는 중…" then the variant list; opening a 안 shows the preview; **pins/cursors/chat still work** (realtime unchanged).
  2. Password proposal: `/p/<publicId>` shows the password form; wrong password → `?error=1` inline message; correct → cookie set, content loads.
  3. Private proposal as a guest: forbidden UI + login link. As an editor: content loads.
  4. `GET /api/p/<publicId>/variants` directly: 200 with variants when allowed; 403 when not (e.g. private as guest); 404 for an unknown publicId.
     If no Supabase/secret env, rely on tsc+lint+build and note it.

- [ ] **Step 8: Format + commit**

```bash
npx prettier --write src/pages/public-viewer "app/p/[publicId]/page.tsx" src/legacy/components/preview/public-viewer.tsx src/legacy/components/preview/proposal-editor-preview.tsx "app/p/[publicId]/loading.tsx"
git add -A
git commit -m "feat: public-viewer content client-side via useQuery; drop legacy load-variants (Stage 4)"
```

---

### Task 6: Stage 4 verification gate + handoff update

**Files:** `docs/superpowers/HANDOFF.md` (the rest is verification only)

- [ ] **Step 1: Full green gate** — Node ≥22: `npx tsc --noEmit && npm run lint && npm test && npm run build` → all PASS. Report the test count (the unlock-token test moved, not added → expect unchanged from the pre-Stage-4 128) and confirm the route table gained `GET /api/p/[publicId]/variants`. Read actual counts.

- [ ] **Step 2: No-SSR / gate check** — the viewer page no longer SSR-loads variants:

```bash
grep -rn "loadVariantsForProposal\|@/shared/db\|@drizzle/schema" "app/p/[publicId]/page.tsx"   # expect empty (only resolveViewerGate via the entity remains, which is the gate read — confirm no db/variant load)
grep -rn "db\.\|drizzle" "app/api/p/[publicId]/variants/route.ts"   # expect empty (thin route)
grep -rn "@/shared/db\|@drizzle/schema\|@/legacy/lib" src/pages/public-viewer   # expect empty (client page; legacy COMPONENT import is allowed but no legacy/lib or db)
```

- [ ] **Step 3: FSD layering + barrel safety**

```bash
grep -rn "@/legacy" src/entities/proposal src/features/unlock-access   # expect empty (entity/feature never import legacy)
grep -rn "@/legacy/lib" src/pages/public-viewer                        # expect empty (page may import @/legacy/components, NOT @/legacy/lib)
grep -rn "\.server\"" src/entities/proposal/index.ts                   # expect empty (no server fn in the entity barrel; resolve-viewer-gate + get-viewer-variants .server are imported directly by routes/page, not the barrel)
```

All expected empty.

- [ ] **Step 4: Access promotion is clean (no legacy access lib left in use)**

```bash
grep -rn "legacy/lib/access/cookie\|legacy/lib/access/viewer-gate" app src tests   # expect empty (moved to shared/entity)
test ! -f src/legacy/lib/access/cookie.ts && test ! -f src/legacy/lib/access/viewer-gate.ts && test ! -f "app/p/[publicId]/actions.ts" && test ! -f src/legacy/lib/preview/load-variants.ts && echo "legacy access + loader + actions removed OK"
```

> `src/legacy/lib/access/` should now contain only `safe-redirect.ts`? — no, that moved in Stage 1b. Check what remains; `viewer-gate.ts` + `cookie.ts` are gone; if the dir is empty, note it (final cleanup removes empty dirs in Stage 6).

- [ ] **Step 5: Realtime not broken (structural)** — confirm the layout + realtime cluster are untouched except the gate import:

```bash
grep -rn "RealtimeShell\|resolveViewerGate" "app/p/[publicId]/layout.tsx"   # RealtimeShell present (unchanged); resolveViewerGate now from @/entities/proposal
grep -rn "@/legacy/lib/access/viewer-gate" "app/api/p/[publicId]/pins/route.ts" "app/api/p/[publicId]/chat/route.ts"   # expect empty (repointed to entity)
```

- [ ] **Step 6: Update the handoff** — in `docs/superpowers/HANDOFF.md`: add a Stage 4 "Done" entry (access promoted out of legacy: `unlock-token` → `shared/access`, `resolveViewerGate` → `entities/proposal`, `unlock` action → `features/unlock-access`; new guarded `GET /api/p/[publicId]/variants` + `getViewerVariants` + `proposalQueries.viewerVariants`; viewer page content client-side via `src/pages/public-viewer` while the server page keeps the gate branches; legacy `load-variants.ts` deleted). **Note explicitly:** the public-viewer **UI tree + preview components + pins + cursors + chat + realtime-provider/RealtimeShell remain in `src/legacy`** (one realtime-coupled cluster) and the viewer page + `src/pages/public-viewer` still import the legacy `<PublicViewer>` — their relocation is **Stage 5** (realtime: `entities/{pin,chat-message}`, `features/{pin-comment,send-chat-message}`, `widgets/{preview-canvas,realtime-shell}`, + `GET /api/p/[publicId]/chat`). Update the test count. Set next = **Stage 5**. Commit:

```bash
npx prettier --write docs/superpowers/HANDOFF.md
git add docs/superpowers/HANDOFF.md
git commit -m "docs: handoff — Stage 4 done (viewer access + content read), next = Stage 5 (realtime)"
```

---

## Self-Review (completed by author)

- **Spec/handoff coverage:** new guarded `GET /api/p/[publicId]/variants` + client viewer content (Tasks 3, 5); access promoted out of legacy — `unlock-token`→shared, `resolveViewerGate`→entity, `unlock`→`features/unlock-access` (Tasks 1, 2, 4); page keeps server gate branches, layout + realtime untouched (Task 5); verification + handoff (Task 6). Realtime/pins/chat/preview-UI deferred to Stage 5 (documented).
- **Green-at-every-commit:** each promotion repoints ALL importers in the same task (cookie: viewer-gate+actions; gate: layout+page+pins×2+chat; ViewerVariant: public-viewer). The page flip + `load-variants.ts` delete are one task (5). Tasks 3 adds the read without touching the still-SSR page.
- **Security preserved:** `resolveViewerGate` stays server-only; the new GET re-checks the gate (403/404, no content); `unlock` stays a server action with the HMAC token + `httpOnly` cookie behavior verbatim; `ACCESS_TOKEN_SECRET` never client-side. `unlock-token.ts` gets NO `server-only` (unit-tested), but it is pure crypto + only ever imported by server modules (the gate + the action).
- **Realtime intact:** the layout's `RealtimeShell` + `loadRecentChat` + the entire legacy preview/pins/chat/cursor tree are unchanged except the `resolveViewerGate` import path; the client viewer page feeds the legacy `<PublicViewer>` the same `variants`/`publicId`/`viewer` props the SSR page did.
- **No-placeholder scan:** all code/commands concrete; new files complete; edits show exact snippets.
- **Type consistency:** `ViewerGate` (Task 2) consumed by layout/page; `ViewerVariant`/`ProposalPage` (entity model, Stage 2a) by `getViewerVariants` (Task 3) + the client fetcher + (repointed) `public-viewer`; `proposalQueries.viewerVariants` (Task 3) by the client page (Task 5); `unlock-token` helpers (Task 1) by the gate (Task 2) + the action (Task 4).
- **Known edges / accepted:** `unlock` stays a server action (carve-out from Stage 1b route-handler auth, per spec); the page is a server gate that renders a client content page on `allow` (not a 1-line re-export); `src/pages/public-viewer` imports a legacy component (temporary, Stage 5). Runtime smoke deferred where no Supabase/secret env.

**Adversarial audit (4 lenses: FSD-promotion / ordering-green / Next16-RQ-security / behavior-realtime; high+ findings independently refute-verified):**

- Fixed (the real defect, flagged by 3 lenses): Task 5 deleted `load-variants.ts` but missed its OTHER importer — `proposal-editor-preview.tsx` imports `EditorVariant` from the bridge (would TS2307 the editor detail page). Task 5 Step 3 now drives the repoint off the module-path grep and explicitly repoints `EditorVariant` → `@/entities/proposal`; added the file to Files + the prettier list.
- Fixed (medium): the unlock action file is named `unlock.ts` (not `unlock.server.ts`) — it's a `"use server"` Server Action (client-callable), not a `server-only` module; the `.server.ts` suffix would invite a build-breaking `server-only` add. Global Constraint amended with the feature-barrel Server-Action carve-out.
- Fixed (medium): Task 5's loader-delete guard grep would false-match a `loadVariantsForProposal` mention in `loading.tsx`'s comment — added a step to update that stale comment (loading.tsx now covers only the gate resolution) so the guard stays a true NO-output check.
- Fixed (low): documented the loading-skeleton → "불러오는 중…" flash as an accepted divergence.

## Next: Stage 5 (realtime — pins + chat + cursors)

Relocate the realtime cluster out of `src/legacy`: `entities/{pin,chat-message}` (query factories + client fetchers + server reads), `GET /api/p/[publicId]/chat` (gate-mirrored), thin pins/chat write routes, `features/{pin-comment,send-chat-message}` (RHF+Zod), `widgets/{preview-canvas,realtime-shell}` (the preview + cursors + pin-layer + chat-panel + presence), replacing the Context-based pin/chat data state with React Query while keeping channel/presence/cursor session state in `shared/realtime`. Then Stage 6 (cleanup + full permission audit + delete `src/legacy`).
