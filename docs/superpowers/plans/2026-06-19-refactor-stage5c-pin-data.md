# Refactor Stage 5c — Pin data → `entities/pin` + `features/pin-comment`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate public-viewer **pins** (`pin_comments`) from the provider-relayed `usePins` hook (local `useState` + raw `fetch`) to **React Query**, substage **5c** of Stage 5 — exactly mirroring the chat seam from 5b. Persisted pin data → `entities/pin` (gated read) + `features/pin-comment` (gated CRUD mutations); the realtime channel keeps relaying pin events but now **patches the RQ cache**. Also **finish the chat cleanup deferred from 5b**: once the pins routes stop using legacy `validateChatBody`, delete `src/legacy/lib/meeting/chat.ts` + the legacy `tests/meeting/chat.test.ts`.

**Architecture (data/session seam, applied to pins — same as 5b chat):**

- **Persisted data → React Query:** pins load via `useQuery(pinQueries.list(publicId, variantId, versionId))` → thin gated `GET /api/p/[publicId]/pins?variant=&version=` → `getPins` (gate→allow + membership checks + last-N pins as `PinDTO[]`). CRUD via `features/pin-comment` mutation hooks → thin `POST`/`PATCH`/`DELETE` → gated server fns → `setQueryData` patch.
- **Realtime relay stays in the provider** (unchanged — it already relays `pin`/`pin_updated`/`pin_deleted` via `subscribePins`/`broadcastPin*`). The pin UI (`widgets/preview-canvas/ui/pin-layer.tsx`) bridges incoming `subscribePins` events → `setQueryData` (the merge logic moves out of `usePins` into the widget) and, after a successful mutation, calls the matching `broadcastPin*` (channel is `self:false`, so the actor patches its own cache via the mutation; peers via the bridge).
- **`usePins` is deleted** — its read becomes `pinQueries`, its CRUD becomes `features/pin-comment` hooks, and its realtime merge + `myColor` reach-through move into `pin-layer` (which gains a direct `useRealtimeOptional()` provider edge, replacing the indirect one — a transient widget→legacy edge removed in 5d, same category as `canvas-cursors`).

**Tech Stack:** Next.js 16 (thin route handlers), React 19, `@tanstack/react-query` v5 (`queryOptions`/`useQuery`/`useMutation`/`setQueryData`), Zod v4, Drizzle, Supabase Realtime (broadcast). Node ≥22.

**Source:** Stage 5 cluster map + decomposition (Option B, user-approved 2026-06-19). Builds on 5a (`widgets/preview-canvas`) + 5b (chat seam + `resolveViewerGate` in `shared/access`). Handoff: `docs/superpowers/HANDOFF.md`.

## Global Constraints

- **Node ≥22** (active, v22.18.0 — do not switch).
- **FSD layer order:** `shared < entities < features < widgets < pages < app`. `entities`/`features` must NOT import `@/legacy`. The widget `pin-layer.tsx` MAY temporarily import the legacy realtime provider (`@/legacy/components/realtime/realtime-provider`, for `useRealtimeOptional` → `subscribePins`/`broadcastPin*`/`myColor`) — a documented transient removed in **5d**. Entity/feature barrels export only client-safe modules (never a `server-only` `*.server.ts`).
- **Access gate (security) — preserve the exact asymmetry:**
  - **read (GET / `getPins`):** `resolveViewerGate`→`allow` (no login). + membership checks.
  - **create (POST / `createPinComment`):** gate→`allow` **AND** logged-in (`getProfile`, else `LOGIN_REQUIRED` 401). + membership + page-range checks.
  - **edit body (PATCH body):** gate→`allow` + logged-in + **author-only** (`pin.authorId === profile.id`, else `NOT_AUTHOR` 403).
  - **toggle resolved (PATCH resolved):** gate→`allow` + logged-in (any user).
  - **delete (DELETE):** gate→`allow` + logged-in + **author-only**.
  - **PATCH XOR:** exactly one of `body` | `resolved` (legacy returned `ONE_FIELD` 400; Zod-refine → 400 `VALIDATION_ERROR` — acceptable divergence).
  - The gate returns 403/404/401 with **no pin data** when denied. Author identity (`authorId`/`authorName`) comes from `getProfile` (NOT the client); `authorColor` comes from the client guest identity (length-clamped). `xNorm`/`yNorm` clamped via `clamp01`.
- **Behavior preservation:** pins load per (variant, version), oldest→newest; create/edit/resolve/delete behave identically and broadcast after a successful write; the channel is `self:false` (actor patches own cache via mutation; peers via bridge); the realtime merge filters by `variantId`/`versionId` (pin/pin_updated) and removes by id (pin_deleted). `MAX` body = 2000.
- **Documented divergences (accepted):** (1) the legacy pin routes collapsed `!proposal || decision!=="allow"` into one uniform `FORBIDDEN` 403; the migrated server fns split it into `NOT_FOUND` (404, missing proposal) + `FORBIDDEN` (403, not allowed) — this matches the Stage-4 `getViewerVariants` and 5b `getRecentChat` reads (consistency) and only changes the denial status for a nonexistent (unguessable) `publicId`; no pin data is leaked either way. (2) over-length `authorColor`/`body` now **reject** (Zod `.max` → 400) rather than silently truncate (legacy `slice(32)`); unreachable in practice (`authorColor = rt?.myColor ?? "#3b82f6"`, body bounded by the input `maxLength`). (3) the distinct legacy 400 codes (`INVALID_BODY`/`INVALID_INPUT`/`ONE_FIELD`) collapse to one Zod 400 `VALIDATION_ERROR` (`BAD_PAGE`/`BAD_QUERY` keep their explicit 400 via `STATUS_BY_CODE`). Clients check `res.ok` only.
- **Green at every commit.** Routes keep their current response shapes (`{ pins }` / `{ pin }` / `{ id }`) until `usePins` is deleted (Task 3), so the still-live `usePins` keeps working through Tasks 1–2. Verify `tsc --noEmit` + `lint` + `test` + `build`. Greps scope `src app tests`.
- **One commit per task.** Prettier-format touched/new files (quote bracketed paths).

### Verified current facts

- `pin_comments`: `{ id, proposalId, variantId, versionId, pageOrder int, xNorm real, yNorm real, authorId uuid|null, authorName, authorColor, body, resolved bool, createdAt timestamptz }`.
- `PinDTO`/`PinEvent`/`PinContext` in `src/legacy/lib/pins/types.ts` (PinContext = `{ publicId, variantId, versionId, viewerId: string|null }`).
- `loadPinsForVersion(variantId, versionId)` (`lib/pins/load-pins.ts`): `where variantId AND versionId`, `orderBy createdAt asc, id asc`, map to DTO (`createdAt.toISOString()`).
- GET `pins/route.ts`: gate→allow (403) + `variant`/`version` query (400 `BAD_QUERY` if missing) + membership (variant→proposal, version→variant; 404) + `loadPinsForVersion` → `{ pins }`.
- POST `pins/route.ts`: gate→allow + `getProfile` (401 `LOGIN_REQUIRED`) + `validateChatBody` (400 `INVALID_BODY`) + input validation (variantId/versionId strings, pageOrder int≥0, authorColor slice(32), xNorm/yNorm numbers; else 400 `INVALID_INPUT`) + membership + page-range (`BAD_PAGE` 400) + insert (`authorName = profile.displayName ?? profile.email.split("@")[0] ?? "사용자"`, `clamp01` x/y) → `{ pin }`.
- PATCH `[pinId]/route.ts`: `gateAndLoad` (gate→allow + getProfile + load pin by (id, proposalId); 403/401/404) + XOR(body|resolved) (`ONE_FIELD` 400) → body: author-only (`NOT_AUTHOR` 403) + `validateChatBody` + update body; resolved: any logged-in + update → `{ pin }`. DELETE: `gateAndLoad` + author-only → delete → `{ id }`.
- `usePins(pin)` (`lib/pins/use-pins.ts`): `useRealtimeOptional()`; `fetch GET ...?variant=&version=` → `setPins(d.pins)`; `subscribePins` merge (filter by variant/version; pin_deleted by id); `createPin`/`editPin`/`toggleResolved`/`deletePin` (fetch → setPins → `rt?.broadcastPin*`); `authorColor: rt?.myColor ?? "#3b82f6"` on create.
- `pin-layer.tsx` (widget) calls `usePins(pin)` and renders markers/composer/popover; `clamp01`/`toContent` in `@/shared/realtime/coords`; `locate` in `../lib/locate`.
- `validateChatBody` (legacy `lib/meeting/chat.ts`) importers AFTER 5b: `pins/route.ts`, `pins/[pinId]/route.ts`, `tests/meeting/chat.test.ts`. `MAX_CHAT_BODY` importer: none in chat (chat-panel moved to entity in 5b) — confirm via grep.
- `to-error-response.ts` `STATUS_BY_CODE` has FORBIDDEN 403, LOGIN_REQUIRED 401, NOT_FOUND 404 — but **NOT `NOT_AUTHOR`** (add it → 403).

---

### Task 1: `entities/pin` slice + thin gated `GET /api/p/[publicId]/pins`

**Files:**

- Create: `src/entities/pin/model/types.ts` (`PinDTO`, `PinEvent`, `PinContext`)
- Create: `src/entities/pin/model/pin-schema.ts` (`MAX_PIN_BODY`, `pinBodySchema`, `createPinInputSchema`, `patchPinInputSchema`, input types)
- Create: `src/entities/pin/api/get-pins.server.ts` (`getPins`)
- Create: `src/entities/pin/api/get-pins.ts` (client fetcher)
- Create: `src/entities/pin/api/pin.query.ts` (`pinQueries`)
- Create: `src/entities/pin/index.ts` (barrel)
- Create: `tests/entities/pin/pin-schema.test.ts` (Zod unit test — pure logic)
- Modify: `app/api/p/[publicId]/pins/route.ts` (rewrite `GET` thin; leave `POST` for Task 2)
- Modify: `src/legacy/lib/pins/types.ts` → re-export bridge (`export type { PinDTO, PinEvent, PinContext } from "@/entities/pin";`) so `use-pins`/provider/`pin-layer` keep compiling

- [ ] **Step 1: `model/types.ts`** — copy `PinDTO`, `PinEvent`, `PinContext` verbatim from `src/legacy/lib/pins/types.ts`.

- [ ] **Step 2: `model/pin-schema.ts`** — Zod (replaces `validateChatBody` + the POST/PATCH input validation):

```ts
import { z } from "zod";

export const MAX_PIN_BODY = 2000;
export const pinBodySchema = z.string().trim().min(1).max(MAX_PIN_BODY);

export const createPinInputSchema = z.object({
  variantId: z.string().min(1),
  versionId: z.string().min(1),
  pageOrder: z.number().int().min(0),
  xNorm: z.number(),
  yNorm: z.number(),
  authorColor: z.string().trim().min(1).max(32),
  body: pinBodySchema,
});
export type CreatePinInput = z.infer<typeof createPinInputSchema>;

// PATCH = exactly one of { body } | { resolved } (the legacy ONE_FIELD XOR).
export const patchPinInputSchema = z.union([
  z.object({ body: pinBodySchema }).strict(),
  z.object({ resolved: z.boolean() }).strict(),
]);
export type PatchPinInput = z.infer<typeof patchPinInputSchema>;
```

> `z.union` of two `.strict()` objects enforces XOR: `{body, resolved}` together fails both members (extra key), `{}` fails both. A `ZodError` → `toErrorResponse` → 400. (Divergence: `ONE_FIELD`/`INVALID_BODY`/`INVALID_INPUT` collapse to one 400 `VALIDATION_ERROR` — acceptable; clients check `res.ok`.)

- [ ] **Step 3: `api/get-pins.server.ts`** — gated + membership-checked read (move `loadPinsForVersion` logic inline; gate from shared):

```ts
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { pinComments, proposalVariants, proposalVersions } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import type { PinDTO } from "../model/types";

export async function getPins(
  publicId: string,
  variantId: string,
  versionId: string,
): Promise<PinDTO[]> {
  // Gate FIRST (legacy ordering — never validate/query before the access check).
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  if (!variantId || !versionId) throw new Error("BAD_QUERY"); // 400 (mapped in to-error-response)

  // membership: variant ∈ proposal, version ∈ variant
  const v = await db
    .select({ id: proposalVariants.id })
    .from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, proposal.id)))
    .limit(1);
  if (v.length === 0) throw new Error("NOT_FOUND");
  const ver = await db
    .select({ id: proposalVersions.id })
    .from(proposalVersions)
    .where(and(eq(proposalVersions.id, versionId), eq(proposalVersions.variantId, variantId)))
    .limit(1);
  if (ver.length === 0) throw new Error("NOT_FOUND");

  const rows = await db
    .select()
    .from(pinComments)
    .where(and(eq(pinComments.variantId, variantId), eq(pinComments.versionId, versionId)))
    .orderBy(asc(pinComments.createdAt), asc(pinComments.id));
  return rows.map((r) => ({
    id: r.id,
    variantId: r.variantId,
    versionId: r.versionId,
    pageOrder: r.pageOrder,
    xNorm: r.xNorm,
    yNorm: r.yNorm,
    authorId: r.authorId,
    authorName: r.authorName,
    authorColor: r.authorColor,
    body: r.body,
    resolved: r.resolved,
    createdAt: r.createdAt.toISOString(),
  }));
}
```

> `BAD_QUERY`/`NOT_FOUND`/`FORBIDDEN` are all in `STATUS_BY_CODE` (Task 2 Step 1 adds `BAD_QUERY: 400`) → 400/404/403. The gate runs before the param check so a malformed request is still gated (no 500, no gate bypass).

- [ ] **Step 4: `api/get-pins.ts`** (client fetcher; keep `{ pins }` wrapper to match the still-live `usePins`):

```ts
import { http } from "@/shared/api/http";
import type { PinDTO } from "../model/types";

export function getPins(publicId: string, variantId: string, versionId: string): Promise<PinDTO[]> {
  const qs = new URLSearchParams({ variant: variantId, version: versionId });
  return http<{ pins: PinDTO[] }>(`/api/p/${publicId}/pins?${qs}`).then((r) => r.pins);
}
```

- [ ] **Step 5: `api/pin.query.ts`**:

```ts
import { queryOptions } from "@tanstack/react-query";
import { getPins } from "./get-pins";

export const pinQueries = {
  all: () => ["pin"] as const,
  list: (publicId: string, variantId: string, versionId: string) =>
    queryOptions({
      queryKey: [...pinQueries.all(), "list", publicId, variantId, versionId],
      queryFn: () => getPins(publicId, variantId, versionId),
    }),
};
```

- [ ] **Step 6: `index.ts`** (client-safe barrel):

```ts
export { pinQueries } from "./api/pin.query";
export { getPins as fetchPins } from "./api/get-pins";
export type { PinDTO, PinEvent, PinContext } from "./model/types";
export {
  MAX_PIN_BODY,
  pinBodySchema,
  createPinInputSchema,
  patchPinInputSchema,
  type CreatePinInput,
  type PatchPinInput,
} from "./model/pin-schema";
```

- [ ] **Step 7: `tests/entities/pin/pin-schema.test.ts`** — assert: `pinBodySchema` trims + 1..2000; `createPinInputSchema` accepts a valid payload + rejects missing/bad fields (e.g. negative pageOrder, empty body, over-length authorColor); `patchPinInputSchema` accepts `{body}` alone + `{resolved}` alone + REJECTS `{}`, `{body, resolved}`, and `{resolved, extra}`. (Mirror the 5b `chat-schema.test.ts` style.)

- [ ] **Step 8: Rewrite the `GET` thin** in `app/api/p/[publicId]/pins/route.ts` (leave `POST` for Task 2 — keep its imports it needs):

```ts
import { getPins } from "@/entities/pin/api/get-pins.server";
import { toErrorResponse } from "@/shared/api/to-error-response";
// ... GET:
export async function GET(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const url = new URL(req.url);
    const variantId = url.searchParams.get("variant") ?? "";
    const versionId = url.searchParams.get("version") ?? "";
    return Response.json({ pins: await getPins(publicId, variantId, versionId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

(Keep `{ pins }` so the still-live `usePins` `d.pins` works. Drop the now-dead `loadPinsForVersion` import from this file — GET no longer uses it and POST never did (POST is rewritten in Task 2; `load-pins.ts` itself is deleted in Task 3). Leave the POST + its `validateChatBody`/`PinDTO`/db imports for Task 2.)

- [ ] **Step 9: `PinDTO`/`PinEvent`/`PinContext` bridge** — replace the type bodies in `src/legacy/lib/pins/types.ts` with `export type { PinDTO, PinEvent, PinContext } from "@/entities/pin";` (keep the comments). Keeps `use-pins`/provider/`pin-layer` compiling until Task 3.

- [ ] **Step 10: Verify + commit.** `npx tsc --noEmit && npm run lint && npm test && npm run build` PASS (new pin-schema test passes; pins GET still `{pins}`; 27 routes). `grep -rn "@/legacy" src/entities/pin` → empty.

```bash
npx prettier --write src/entities/pin tests/entities/pin "app/api/p/[publicId]/pins/route.ts" src/legacy/lib/pins/types.ts
git add -A
git commit -m "feat: entities/pin + thin gated GET /api/p/[publicId]/pins (Stage 5c)"
```

---

### Task 2: `features/pin-comment` (gated CRUD) + thin `POST`/`PATCH`/`DELETE`

**Files:**

- Create: `src/features/pin-comment/api/create-pin-comment.server.ts` (`createPinComment`)
- Create: `src/features/pin-comment/api/update-pin-comment.server.ts` (`updatePinComment`)
- Create: `src/features/pin-comment/api/delete-pin-comment.server.ts` (`deletePinComment`)
- Create: `src/features/pin-comment/api/use-pin-mutations.ts` (`useCreatePin`, `useEditPin`, `useToggleResolved`, `useDeletePin`)
- Create: `src/features/pin-comment/index.ts`
- Modify: `app/api/p/[publicId]/pins/route.ts` (rewrite `POST` thin)
- Modify: `app/api/p/[publicId]/pins/[pinId]/route.ts` (rewrite `PATCH` + `DELETE` thin)
- Modify: `src/shared/api/to-error-response.ts` (add `NOT_AUTHOR: 403`)

> Server fns preserve the gate asymmetry + membership + author-ownership + XOR verbatim. Mutations are broadcast-free (the widget broadcasts after success in Task 3). The mutation hooks `setQueryData`-patch the active `pinQueries.list` key. Routes keep returning `{ pin }` / `{ id }` so the still-live `usePins` works until Task 3.

- [ ] **Step 1: `to-error-response.ts`** — add **all three** to `STATUS_BY_CODE`: `NOT_AUTHOR: 403,` (author-ownership), `BAD_PAGE: 400,` (page-range; legacy returned 400), `BAD_QUERY: 400,` (missing variant/version on the read; legacy returned 400). Without these, `getPins`/`createPinComment` throwing those messages would fall through to a generic 500 — a 400/403→500 client regression.

- [ ] **Step 2: `create-pin-comment.server.ts`** — gate→allow + login + Zod + membership + page-range + insert (mirror the legacy POST body, replacing `validateChatBody`+manual checks with `createPinInputSchema`):

```ts
import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { pinComments, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { getProfile } from "@/shared/auth/guards.server";
import { clamp01 } from "@/shared/realtime/coords";
import { createPinInputSchema } from "@/entities/pin";
import type { PinDTO } from "@/entities/pin";

export async function createPinComment(publicId: string, raw: unknown): Promise<PinDTO> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  const profile = await getProfile();
  if (!profile) throw new Error("LOGIN_REQUIRED");

  const { variantId, versionId, pageOrder, xNorm, yNorm, authorColor, body } =
    createPinInputSchema.parse(raw);

  const v = await db
    .select({ id: proposalVariants.id })
    .from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, proposal.id)))
    .limit(1);
  if (v.length === 0) throw new Error("NOT_FOUND");
  const ver = await db
    .select({ id: proposalVersions.id })
    .from(proposalVersions)
    .where(and(eq(proposalVersions.id, versionId), eq(proposalVersions.variantId, variantId)))
    .limit(1);
  if (ver.length === 0) throw new Error("NOT_FOUND");
  const pg = await db
    .select({ id: proposalPages.id })
    .from(proposalPages)
    .where(and(eq(proposalPages.versionId, versionId), eq(proposalPages.pageOrder, pageOrder)))
    .limit(1);
  if (pg.length === 0) throw new Error("BAD_PAGE");

  const id = randomUUID();
  const createdAt = new Date();
  const authorName = profile.displayName ?? profile.email.split("@")[0] ?? "사용자";
  const cx = clamp01(xNorm);
  const cy = clamp01(yNorm);
  await db.insert(pinComments).values({
    id,
    proposalId: proposal.id,
    variantId,
    versionId,
    pageOrder,
    xNorm: cx,
    yNorm: cy,
    authorId: profile.id,
    authorName,
    authorColor,
    body,
    createdAt,
  });
  return {
    id,
    variantId,
    versionId,
    pageOrder,
    xNorm: cx,
    yNorm: cy,
    authorId: profile.id,
    authorName,
    authorColor,
    body,
    resolved: false,
    createdAt: createdAt.toISOString(),
  };
}
```

> Add `BAD_PAGE: 400` to `STATUS_BY_CODE` too (legacy returned 400) — OR accept it 500s; preserve the 400 by adding it (do it, it's a real client-facing validation). [Decision: add `BAD_PAGE: 400` in Step 1 alongside `NOT_AUTHOR`.]

- [ ] **Step 3: `update-pin-comment.server.ts`** — gate→allow + login + load + XOR + author-only-for-body:

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { pinComments } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { getProfile } from "@/shared/auth/guards.server";
import { patchPinInputSchema } from "@/entities/pin";
import type { PinDTO } from "@/entities/pin";

// Verbatim from the legacy [pinId]/route.ts toDTO.
function toDTO(r: typeof pinComments.$inferSelect): PinDTO {
  return {
    id: r.id,
    variantId: r.variantId,
    versionId: r.versionId,
    pageOrder: r.pageOrder,
    xNorm: r.xNorm,
    yNorm: r.yNorm,
    authorId: r.authorId,
    authorName: r.authorName,
    authorColor: r.authorColor,
    body: r.body,
    resolved: r.resolved,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function updatePinComment(
  publicId: string,
  pinId: string,
  raw: unknown,
): Promise<PinDTO> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  const profile = await getProfile();
  if (!profile) throw new Error("LOGIN_REQUIRED");
  const rows = await db
    .select()
    .from(pinComments)
    .where(and(eq(pinComments.id, pinId), eq(pinComments.proposalId, proposal.id)))
    .limit(1);
  const pin = rows[0];
  if (!pin) throw new Error("NOT_FOUND");

  const input = patchPinInputSchema.parse(raw);
  if ("body" in input) {
    if (pin.authorId !== profile.id) throw new Error("NOT_AUTHOR");
    await db.update(pinComments).set({ body: input.body }).where(eq(pinComments.id, pinId));
    return toDTO({ ...pin, body: input.body });
  }
  await db.update(pinComments).set({ resolved: input.resolved }).where(eq(pinComments.id, pinId));
  return toDTO({ ...pin, resolved: input.resolved });
}
```

(`toDTO` is inlined above — identical to the legacy `[pinId]/route.ts` mapping.)

- [ ] **Step 4: `delete-pin-comment.server.ts`** — gate→allow + login + load + author-only + delete:

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { pinComments } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { getProfile } from "@/shared/auth/guards.server";

export async function deletePinComment(publicId: string, pinId: string): Promise<{ id: string }> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  const profile = await getProfile();
  if (!profile) throw new Error("LOGIN_REQUIRED");
  const rows = await db
    .select()
    .from(pinComments)
    .where(and(eq(pinComments.id, pinId), eq(pinComments.proposalId, proposal.id)))
    .limit(1);
  const pin = rows[0];
  if (!pin) throw new Error("NOT_FOUND");
  if (pin.authorId !== profile.id) throw new Error("NOT_AUTHOR");
  await db.delete(pinComments).where(eq(pinComments.id, pinId));
  return { id: pinId };
}
```

- [ ] **Step 5: `use-pin-mutations.ts`** — 4 hooks; each `setQueryData`-patches the active key; returns the saved pin so the widget can broadcast. Match the real `http` signature (mirror `features/send-chat-message/api/use-send-chat-message.ts`). Sketch:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import { pinQueries, type PinDTO, type CreatePinInput } from "@/entities/pin";

export function useCreatePin(publicId: string, variantId: string, versionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePinInput) =>
      http<{ pin: PinDTO }>(`/api/p/${publicId}/pins`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.pin),
    onSuccess: (pin) =>
      qc.setQueryData<PinDTO[]>(pinQueries.list(publicId, variantId, versionId).queryKey, (prev) =>
        prev && prev.some((p) => p.id === pin.id) ? prev : [...(prev ?? []), pin],
      ),
  });
}
export function useEditPin(publicId: string, variantId: string, versionId: string) {
  /* PATCH {body}; setQueryData map-replace */
}
export function useToggleResolved(publicId: string, variantId: string, versionId: string) {
  /* PATCH {resolved}; setQueryData map-replace */
}
export function useDeletePin(publicId: string, variantId: string, versionId: string) {
  /* DELETE → {id}; setQueryData filter */
}
```

> `useEditPin`/`useToggleResolved`: `mutationFn: ({ pinId, ... }) => http<{pin}>(`.../pins/${pinId}`, { method:"PATCH", body: JSON.stringify({ body }|{ resolved }) }).then(r=>r.pin)`; `onSuccess` map-replace by id. `useDeletePin`: `mutationFn: (pinId) => http<{id}>(`.../pins/${pinId}`, { method:"DELETE" }).then(r=>r.id)`; `onSuccess` filter out by id. All keyed on the same `pinQueries.list(...)`.

- [ ] **Step 6: `index.ts`** — `export { useCreatePin, useEditPin, useToggleResolved, useDeletePin } from "./api/use-pin-mutations";`

- [ ] **Step 7: Rewrite the POST** (`pins/route.ts`) thin: `try { const {publicId}=await params; const raw = await req.json().catch(()=>null); const pin = await createPinComment(publicId, raw); return Response.json({ pin }); } catch (error) { return toErrorResponse(error); }`. Remove now-dead POST imports (`getProfile`, `validateChatBody`, `clamp01`, `randomUUID`, `pinComments`/variant/version/page tables, `loadPinsForVersion` if GET no longer uses it — GET now uses `getPins`, so `loadPinsForVersion` + `validateChatBody` are fully removable from this file). Confirm no dead imports.

- [ ] **Step 8: Rewrite PATCH + DELETE** (`pins/[pinId]/route.ts`) thin: PATCH → `updatePinComment(publicId, pinId, raw)` → `{ pin }`; DELETE → `deletePinComment(publicId, pinId)` → `{ id }`. Both `try/catch → toErrorResponse`, `req.json().catch(()=>null)` for PATCH. Remove the whole legacy `gateAndLoad`/`toDTO`/`validateChatBody` + direct db usage from the route file.

- [ ] **Step 9: Verify + commit.** `npx tsc --noEmit && npm run lint && npm test && npm run build` PASS (132+pin-schema tests; pins routes thin; 27 routes). `grep -rn "@/legacy" src/features/pin-comment` → empty. `grep -rn "validateChatBody\|loadPinsForVersion\|db\.\|drizzle" "app/api/p/[publicId]/pins/route.ts" "app/api/p/[publicId]/pins/[pinId]/route.ts"` → empty (routes fully thin, off legacy validateChatBody).

```bash
npx prettier --write src/features/pin-comment src/shared/api/to-error-response.ts "app/api/p/[publicId]/pins/route.ts" "app/api/p/[publicId]/pins/[pinId]/route.ts"
git add -A
git commit -m "feat: features/pin-comment + thin pin POST/PATCH/DELETE; routes off validateChatBody (Stage 5c)"
```

---

### Task 3: Flip `pin-layer` to React Query — delete `usePins`, bridge in the widget

**Files:**

- Modify: `src/widgets/preview-canvas/ui/pin-layer.tsx` (useQuery + feature mutations + `useRealtimeOptional` bridge + broadcast + myColor)
- Modify (repoint `PinContext` import `@/legacy/lib/pins/types` → `@/entities/pin` — these import the bridge that Step 3 deletes): `src/widgets/preview-canvas/ui/public-viewer.tsx`, `src/widgets/preview-canvas/ui/proposal-preview.tsx`, `src/widgets/preview-canvas/ui/canvas-view.tsx`
- Modify: `src/legacy/components/realtime/realtime-provider.tsx` (repoint `import type { PinDTO, PinEvent }` → `@/entities/pin`)
- Delete: `src/legacy/lib/pins/use-pins.ts`, `src/legacy/lib/pins/load-pins.ts`, `src/legacy/lib/pins/types.ts`

> `pin-layer` replaces `usePins` with: `useQuery(pinQueries.list)` for the list; `useRealtimeOptional()` (legacy provider, transient) for `subscribePins`/`broadcastPin*`/`myColor`; the feature mutation hooks for CRUD. The realtime merge logic (filter by variant/version; pin_deleted by id) moves into a bridge `useEffect` (`subscribePins` → `setQueryData`), preserving the stable-ref subscription. The component's draft/popover/marker UI is UNCHANGED except the data source + the action callbacks.

- [ ] **Step 1: Rewrite `pin-layer.tsx` data wiring** (keep all the UI/markup, drafts, popovers, `measureBoxes`, `locate`/`placePin`):
  - Replace `const { pins, createPin, editPin, toggleResolved, deletePin } = usePins(pin);` with:
    - `const { publicId, variantId, versionId } = pin;`
    - `const rt = useRealtimeOptional();` (from `@/legacy/components/realtime/realtime-provider` — transient)
    - `const { data: pins = [] } = useQuery(pinQueries.list(publicId, variantId, versionId));`
    - `const qc = useQueryClient();`
    - mutation hooks: `const createMut = useCreatePin(publicId, variantId, versionId);` etc.
  - **Bridge effect** (mirror `usePins`'s merge, keyed by the stable `rt?.subscribePins`):

```ts
const subscribePins = rt?.subscribePins;
useEffect(() => {
  if (!subscribePins) return;
  return subscribePins((e) => {
    const key = pinQueries.list(publicId, variantId, versionId).queryKey;
    if (e.type === "pin_deleted") {
      qc.setQueryData<PinDTO[]>(key, (prev) => prev?.filter((p) => p.id !== e.id));
      return;
    }
    const p = e.pin;
    if (p.variantId !== variantId || p.versionId !== versionId) return;
    qc.setQueryData<PinDTO[]>(key, (prev) => {
      if (!prev) return prev;
      return prev.some((x) => x.id === p.id)
        ? prev.map((x) => (x.id === p.id ? p : x))
        : [...prev, p];
    });
  });
}, [subscribePins, qc, publicId, variantId, versionId]);
```

- **Action callbacks** (the mutation runs, then broadcast on success; mirror `usePins`):
  - create (`submitDraft`): `createMut.mutate({ ...draft, body, variantId, versionId, authorColor: rt?.myColor ?? "#3b82f6" }, { onSuccess: (saved) => { rt?.broadcastPin(saved); setDraft(null); setDraftBody(""); } })`.
  - edit: `editMut.mutate({ pinId: p.id, body }, { onSuccess: (saved) => { rt?.broadcastPinUpdated(saved); setEditingId(null); } })`.
  - toggleResolved: `resolveMut.mutate({ pinId: p.id, resolved: !p.resolved }, { onSuccess: (saved) => rt?.broadcastPinUpdated(saved) })`.
  - delete: `deleteMut.mutate(p.id, { onSuccess: (id) => rt?.broadcastPinDeleted(id) })`.
- Imports: add `useEffect` (already imported? add if needed), `useQuery`/`useQueryClient` from `@tanstack/react-query`, `pinQueries`/`type PinDTO`/`type PinContext` from `@/entities/pin`, the 4 hooks from `@/features/pin-comment`, `useRealtimeOptional` from `@/legacy/components/realtime/realtime-provider`. Drop `import { usePins }` + `import type { PinContext } from "@/legacy/lib/pins/types"`.

- [ ] **Step 2: Repoint ALL remaining `@/legacy/lib/pins/types` importers** (the Task-1 bridge masked these through Tasks 1–2; they break when Step 3 deletes the bridge). Change the import source to `@/entities/pin`:
  - `src/legacy/components/realtime/realtime-provider.tsx`: `import type { PinDTO, PinEvent }` → `@/entities/pin`. (Relay logic otherwise UNCHANGED.)
  - `src/widgets/preview-canvas/ui/public-viewer.tsx`: `import type { PinContext }` → `@/entities/pin`.
  - `src/widgets/preview-canvas/ui/proposal-preview.tsx`: `import type { PinContext }` → `@/entities/pin`.
  - `src/widgets/preview-canvas/ui/canvas-view.tsx`: `import type { PinContext }` → `@/entities/pin`.
    Confirm the full set first: `grep -rln "@/legacy/lib/pins/types" src app tests` — every hit (besides pin-layer.tsx handled in Step 1, and use-pins/load-pins deleted in Step 3) must be repointed here.

- [ ] **Step 3: Delete the legacy pin libs.**

```bash
git rm src/legacy/lib/pins/use-pins.ts src/legacy/lib/pins/load-pins.ts src/legacy/lib/pins/types.ts
grep -rn "lib/pins/use-pins\|lib/pins/load-pins\|lib/pins/types\|usePins\|loadPinsForVersion" src app tests   # expect NO output
# src/legacy/lib/pins/ should now be empty (locate.ts moved in 5a) → rmdir
rmdir src/legacy/lib/pins 2>/dev/null || true
```

- [ ] **Step 4: Verify green.** `npx tsc --noEmit && npm run lint && npm test && npm run build` PASS (27 routes). The widget's pin transient edge is now `useRealtimeOptional` (provider) only:

```bash
grep -rn "@/legacy" src/widgets/preview-canvas   # ONLY @/legacy/components/realtime/realtime-provider in canvas-cursors.tsx + pin-layer.tsx (transient, 5d) — NO @/legacy/lib
grep -rn "@/legacy/lib/pins" src app tests   # empty (gone; all PinContext/PinDTO importers repointed in Steps 1-2)
```

- [ ] **Step 5: Manual realtime E2E (if Supabase env).** Two browsers, public proposal, open a 안 in comment mode: place a pin in A → appears in A (mutation) + B (broadcast→bridge); edit/resolve/delete in A → reflects in B; guest (logged-out) gets the login prompt on draft; reload → pins persist (GET). Cursors/chat still work. If no env, rely on tsc/lint/test/build + note it.

- [ ] **Step 6: Format + commit.**

```bash
npx prettier --write src/widgets/preview-canvas/ui/pin-layer.tsx src/widgets/preview-canvas/ui/public-viewer.tsx src/widgets/preview-canvas/ui/proposal-preview.tsx src/widgets/preview-canvas/ui/canvas-view.tsx src/legacy/components/realtime/realtime-provider.tsx
git add -A
git commit -m "feat: pins on React Query (widget bridge + feature mutations); drop legacy use-pins/load-pins (Stage 5c)"
```

---

### Task 4: Finish the chat cleanup deferred from 5b

**Files:**

- Delete: `src/legacy/lib/meeting/chat.ts`, `tests/meeting/chat.test.ts`
- (Confirm `src/legacy/lib/meeting/` is then empty → `rmdir`)

> After Task 2, the pins routes no longer import `validateChatBody`. The only remaining importer of `lib/meeting/chat.ts` is `tests/meeting/chat.test.ts`. The new `entities/chat-message` `chat-schema.test.ts` (added in 5b) already covers the equivalent trim/length logic, so the legacy `validateChatBody` test is redundant and is removed with the module.

- [ ] **Step 1: Confirm legacy `chat.ts`/`validateChatBody` has no remaining SOURCE importer.** (Scope the grep to the LEGACY module path — a bare `MAX_CHAT_BODY` token would false-match `chat-panel.tsx`, which correctly imports `MAX_CHAT_BODY` from `@/entities/chat-message` since 5b.)

```bash
grep -rn "@/legacy/lib/meeting/chat\|validateChatBody" src app   # expect NO output (only the test should remain)
grep -rn "@/legacy/lib/meeting/chat\|validateChatBody" tests   # expect ONLY tests/meeting/chat.test.ts
```

If any SOURCE file (src/app) still imports it, STOP — Task 2 didn't fully migrate the pins routes; fix that first.

- [ ] **Step 2: Delete the module + its now-redundant test.**

```bash
git rm src/legacy/lib/meeting/chat.ts tests/meeting/chat.test.ts
ls -A src/legacy/lib/meeting 2>/dev/null   # expect empty
rmdir src/legacy/lib/meeting 2>/dev/null || true
grep -rn "@/legacy/lib/meeting\|validateChatBody\|loadRecentChat" src app tests   # expect NO output
```

- [ ] **Step 3: Verify + commit.** `npx tsc --noEmit && npm run lint && npm test && npm run build` PASS. Test count = (5b's **132**) **+ the pin-schema cases added in Task 1** (Step 7) **− the 5 legacy `validateChatBody` cases** removed here = `132 + N − 5` (`chat-schema` + `pin-schema` entity tests remain). Report the EXACT `npm test` count, not a hardcoded number.

```bash
git add -A
git commit -m "chore: delete legacy meeting/chat.ts + redundant validateChatBody test (Stage 5c)"
```

---

### Task 5: Stage 5c verification gate + handoff

**Files:** `docs/superpowers/HANDOFF.md` (rest verification only).

- [ ] **Step 1: Full green gate.** `npx tsc --noEmit && npm run lint && npm test && npm run build` → all PASS. Report the exact test count + route count (27).

- [ ] **Step 2: Migration correctness greps.**

```bash
grep -rn "@/legacy" src/entities/pin src/features/pin-comment   # empty
grep -rn "@/legacy/lib/pins\|@/legacy/lib/meeting\|usePins\|loadPinsForVersion\|validateChatBody" src app tests   # empty (all gone)
grep -rn "@/legacy" src/widgets/preview-canvas   # ONLY realtime-provider (canvas-cursors + pin-layer) — the last transient edges for 5d
grep -rn "\.server\"" src/entities/pin/index.ts src/features/pin-comment/index.ts   # empty (no server fn in barrels)
grep -rn "db\.\|drizzle\|validateChatBody" "app/api/p/[publicId]/pins/route.ts" "app/api/p/[publicId]/pins/[pinId]/route.ts"   # empty (thin)
```

- [ ] **Step 3: Gate-asymmetry + seam check (structural).** Confirm: `getPins` gates allow-only (no login) + membership; `createPinComment` gate+login+membership+page; `updatePinComment` XOR + author-only-for-body + any-login-for-resolved; `deletePinComment` author-only; `NOT_AUTHOR`/`BAD_PAGE` in `STATUS_BY_CODE`. The provider's pin relay (`subscribePins`/`broadcastPin*`) is byte-unchanged (only the type import path changed); cursors/presence/chat-relay untouched. `pin-layer` bridges `subscribePins` → `setQueryData` (variant/version filter; pin_deleted by id) and broadcasts after each mutation; `self:false` → actor patches via mutation, peers via bridge.

- [ ] **Step 4: Update the handoff.** Add a Stage 5c "Done" entry: `entities/pin` (PinDTO/PinEvent/PinContext + Zod `pin-schema` with XOR `patchPinInputSchema`, `getPins` gated+membership read, `pinQueries.list(publicId,variantId,versionId)`); `features/pin-comment` (gated `createPinComment`/`updatePinComment`/`deletePinComment` preserving the read=allow / write=login / edit·delete=author-only / resolve=any-login asymmetry + XOR; `useCreatePin`/`useEditPin`/`useToggleResolved`/`useDeletePin`); thin pin `GET`/`POST`/`PATCH`/`DELETE` (off legacy `validateChatBody`); `NOT_AUTHOR`+`BAD_PAGE` added to `to-error-response`; `pin-layer` flipped to React Query + the realtime merge bridge moved into the widget (`subscribePins`→`setQueryData`), broadcasting after each mutation; `myColor` reach-through preserved via `useRealtimeOptional`. Legacy `lib/pins/{use-pins,load-pins,types}` + `lib/meeting/chat.ts` + `tests/meeting/chat.test.ts` deleted (`lib/pins` + `lib/meeting` dirs gone). **Remaining widget→legacy transient edges (removed in 5d):** `canvas-cursors` + `pin-layer` → `realtime-provider` (`useRealtimeOptional`). Update test/route counts. Set next = **Stage 5d (promote RealtimeProvider → shared/realtime + finalize widgets/realtime-shell)**. Commit:

```bash
npx prettier --write docs/superpowers/HANDOFF.md
git add docs/superpowers/HANDOFF.md
git commit -m "docs: handoff — Stage 5c done (pins on React Query), next = 5d provider promotion"
```

---

## Self-Review (completed by author)

- **Spec coverage:** pin data → React Query (entity read + GET, feature CRUD + thin routes), realtime merge moved into the widget bridge, gate asymmetry + XOR + author-ownership + membership + page-range preserved, chat.ts cleanup finished. Cursors/presence/chat-relay + the provider's pin-relay logic untouched (only type-import path changes).
- **Green-at-commit:** routes keep `{pins}`/`{pin}`/`{id}` shapes through Tasks 1–2 so the still-live `usePins` works; Task 3 is the atomic cutover (pin-layer + use-pins delete + provider type repoint); Task 4 deletes chat.ts only after Task 2 took the pins routes off `validateChatBody`. Bridges (`PinDTO`/`PinEvent`/`PinContext`) keep legacy compiling until Task 3.
- **Layering:** entity/feature never import `@/legacy`; the broadcast + provider access live in the widget `pin-layer` (transient `useRealtimeOptional`, removed 5d), not the feature; barrels export no `.server`; gate is the shared primitive (no entity→entity).
- **Security:** the four-way gate asymmetry is preserved verbatim in the server fns; author identity from `getProfile` (server), `authorColor` from client; `NOT_AUTHOR`/`BAD_PAGE` mapped. Documented divergence: `ONE_FIELD`/`INVALID_BODY`/`INVALID_INPUT`/`BAD_QUERY` collapse to one 400 (Zod) except `BAD_PAGE` (explicit 400).
- **Realtime:** `self:false` topology identical to chat (actor via mutation, peers via bridge); the bridge keeps the stable-subscribePins-ref pattern + the variant/version filter + pin_deleted-by-id.
- **No placeholders:** schemas/signatures concrete; the mutation-hook bodies are sketched with exact method/key/patch semantics; `toDTO`/membership copied verbatim from legacy.
- **Risk:** medium-high — most complex substage (4 mutations + a filtered bridge + gate asymmetry). Mitigated by mirroring the proven 5b chat seam + the legacy logic verbatim; tsc/lint/build + the pin-schema test catch wiring; realtime correctness needs the manual E2E (deferred where no env).

**Adversarial audit (4 lenses, blocker/high refute-verified):** one real defect fixed (2 lenses, same class as the 5a audit) — Task 3 deletes the `lib/pins/types.ts` bridge but the Task-1 bridge masked **three** widget importers of `PinContext` (`public-viewer.tsx`, `proposal-preview.tsx`, `canvas-view.tsx`) that were not repointed → TS2307 at the Task-3 commit. Fixed: Task 3 Step 2 now repoints all remaining `@/legacy/lib/pins/types` importers (the 3 widgets + the provider) before the delete, with the files added to the Files/prettier set + a pre-delete grep. Also fixed (low): `STATUS_BY_CODE` now explicitly adds `NOT_AUTHOR:403`+`BAD_PAGE:400`+`BAD_QUERY:400` (else 400/403→500); `getPins` reordered gate-first then `BAD_QUERY`; `toDTO` inlined (was a non-compiling placeholder); the 404-vs-403 split, `authorColor` reject-vs-truncate, and 400-code collapse documented as accepted divergences; Task 1 drops the dead `loadPinsForVersion` import; Task 4 grep scoped to the legacy path (the bare `MAX_CHAT_BODY` token false-matched the entity import); test-count math corrected to `132 + N − 5`. Refuted (no change): the "unused import fails lint" finding — `no-unused-vars` is `warn`, not error.

## Next: Stage 5d (provider promotion)

Promote `RealtimeProvider` `src/legacy/components/realtime/realtime-provider.tsx` → `shared/realtime`; finalize `widgets/realtime-shell` (the channel host + presence-bar + chat-panel segments); remove the last widget→legacy edges (`canvas-cursors` + `pin-layer` → provider); the viewer page + editor preview then have zero `@/legacy` realtime dependency. Then Stage 6 (cleanup + permission audit + delete `src/legacy`).
