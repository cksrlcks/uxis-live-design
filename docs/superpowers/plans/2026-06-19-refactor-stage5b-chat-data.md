# Refactor Stage 5b — Chat data → `entities/chat-message` + `features/send-chat-message`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate the public-viewer **chat** from provider-owned React state to **React Query**, substage **5b** of Stage 5. The persisted chat data (`chat_messages`) becomes an entity read/write on React Query; the realtime channel keeps delivering live messages but now **patches the RQ cache** instead of owning the list. Also do the one-time **prep**: move `resolveViewerGate` → `shared/access` (so the new chat/pin entity reads can import the gate without an entity→entity edge). Pins, cursors, presence, and the provider's promotion are untouched (5c/5d).

**Architecture (the data/session seam, applied to chat):**

- **Persisted data → React Query:** initial chat loads via `useQuery(chatQueries.list(publicId))` → thin gated `GET /api/p/[publicId]/chat` → `getRecentChat` (gate→allow→last 50 `chat_messages` as `ChatMessageDTO[]`). Sending uses `useSendChatMessage` → thin `POST` → `createChatMessage` (gate→allow→validate→insert→return DTO) → `setQueryData` append.
- **Realtime session stays in the provider, but chat becomes relay-only** (exactly mirroring the existing pin pattern `subscribePins`/`broadcastPin`): the provider stops owning `chatMessages`; it exposes `subscribeChat(handler)` + `broadcastChat(message)`; its `"chat"` broadcast handler fans out to subscribers instead of `setChatMessages`. The chat UI bridges incoming `subscribeChat` events → `setQueryData` (append, dedup by id) and, after a successful send, calls `broadcastChat(created)` (the channel is `self:false`, so the sender appends locally via the mutation's `setQueryData`).
- **No more SSR initial chat:** the layout stops calling `loadRecentChat`; the provider/`RealtimeShell` drop the `initialChat` prop. Brief client loading state for chat (accepted, matches the no-SSR goal). The realtime channel still mounts at the layout level (unchanged) so it survives `?v=`/`?compare=` navigation.

**Tech Stack:** Next.js 16 (App Router, thin route handlers), React 19, `@tanstack/react-query` v5 (`queryOptions`, `useQuery`, `useMutation`, `setQueryData`), Zod v4, Drizzle, Supabase Realtime (broadcast). Node ≥22.

**Source:** Stage 5 cluster map + decomposition (Option B, user-approved 2026-06-19). Builds on 5a (`widgets/preview-canvas`). Handoff: `docs/superpowers/HANDOFF.md`.

## Global Constraints

- **Node ≥22** (active, v22.18.0 — do not switch).
- **FSD layer order:** `shared < entities < features < widgets < pages < app`. `entities`/`features` must NOT import `@/legacy`. Legacy MAY import `@/entities`/`@/features`/`@/shared`/`@/widgets`. Entity/feature barrels export only client-safe modules (never a `server-only` `*.server.ts`).
- **The realtime provider + chat-panel stay in `src/legacy` this stage** (they move to `widgets/realtime-shell` in 5d). They MAY import `@/entities/chat-message` + `@/features/send-chat-message` (legacy→entity/feature is allowed). The mutation/broadcast wiring lives in the legacy `chat-panel` (which has provider access) — NOT in the feature (a feature must not import the legacy provider).
- **Access gate stays server-side:** the chat GET + POST both enforce `resolveViewerGate` → `allow` (no login required — public viewers can read/post chat once the visibility/unlock gate passes, per spec §7). Return 403 with no data when not allowed. Authorship (`authorName`/`authorColor`) comes from the client guest identity — length-clamped server-side (unchanged behavior).
- **Behavior preservation:** chat still shows the last 50 messages oldest→newest; sending still posts then appears for everyone; the channel is still `self:false` (sender never receives its own broadcast → the sender's message must be appended locally by the mutation). Malformed broadcast payloads (`!m.id`) are still dropped. `MAX_CHAT_BODY = 2000` still bounds the input (`maxLength`) and is re-validated server-side.
- **Green at every commit.** Each task repoints all importers it touches; the chat-panel flip + provider surgery + legacy-delete happen together (Task 4). Verify `tsc --noEmit` + `lint` + `test` + `build`. Greps scope `src app tests`.
- **One commit per task.** Prettier-format touched/new files (quote bracketed paths).

### Verified current facts

- `chat_messages` table: `{ id uuid, proposalId uuid, authorName text, authorColor text, body text, createdAt timestamptz }`.
- `ChatMessageDTO = { id; authorName; authorColor; body; createdAt: string /* ISO */ }` (legacy `lib/meeting/types.ts`).
- `loadRecentChat(proposalId)` (legacy `lib/meeting/load-chat.ts`): last 50 by `(createdAt desc, id desc)`, `.reverse()` to oldest→newest, `createdAt.toISOString()`. `INITIAL_CHAT_LIMIT = 50`.
- `validateChatBody(raw)` + `MAX_CHAT_BODY = 2000` (legacy `lib/meeting/chat.ts`): trim, 1..2000 chars else null.
- POST `/api/p/[publicId]/chat` (legacy raw handler): gate→allow (403 else); `validateChatBody` (400 `INVALID_BODY`); `authorName`/`authorColor` trimmed+sliced(80/32), required (400 `INVALID_AUTHOR`); insert; returns `{ message: ChatMessageDTO }`. **No GET route exists yet.**
- Provider (`realtime-provider.tsx`): owns `chatMessages` useState seeded from `initialChat` (line 51); `"chat"` broadcast handler appends w/ dedup (87-91); `sendChat(message)` appends locally + broadcasts (153-159). Pin pattern to mirror: `pinSubsRef` + `subscribePins`/`broadcastPin*` (52, 93-107, 161-177).
- `resolveViewerGate` lives at `entities/proposal/api/resolve-viewer-gate.server.ts`; `ViewerGate` type at `entities/proposal/model/types.ts` (NOT in the entity barrel). Importers of the fn (6): `entities/proposal/api/get-viewer-variants.server.ts`, `app/api/p/[publicId]/{chat,pins,pins/[pinId]}/route.ts`, `app/p/[publicId]/{layout,page}.tsx`.

---

### Task 1: Prep — move `resolveViewerGate` + `ViewerGate` → `shared/access`

**Files:**

- Move: `src/entities/proposal/api/resolve-viewer-gate.server.ts` → `src/shared/access/resolve-viewer-gate.server.ts`
- Modify: `src/entities/proposal/model/types.ts` (remove `ViewerGate` — it moves into the gate file)
- Modify (repoint the fn import to `@/shared/access/resolve-viewer-gate.server`): `src/entities/proposal/api/get-viewer-variants.server.ts`, `app/api/p/[publicId]/chat/route.ts`, `app/api/p/[publicId]/pins/route.ts`, `app/api/p/[publicId]/pins/[pinId]/route.ts`, `app/p/[publicId]/layout.tsx`, `app/p/[publicId]/page.tsx`

> `resolveViewerGate` imports only `@/shared/*` + `@drizzle/*` (since Stage 4), so it belongs in `shared/access` next to `unlock-token.ts`. `ViewerGate` (returns `Proposal | null` + `AccessDecision` + viewer) references only drizzle + shared, so it moves into the gate file. It is not in the entity barrel and not imported as a standalone type elsewhere (consumers destructure the return), so no type-import repoints are needed beyond removing the entity definition.

- [ ] **Step 1: Move the gate file.**

```bash
git mv src/entities/proposal/api/resolve-viewer-gate.server.ts src/shared/access/resolve-viewer-gate.server.ts
```

- [ ] **Step 2: Inline the `ViewerGate` type into the moved file.** In `src/shared/access/resolve-viewer-gate.server.ts`, replace `import type { ViewerGate } from "../model/types";` with a local definition (copy it verbatim from `entities/proposal/model/types.ts`):

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

(Keep the rest of the file — `import "server-only"`, `cache(...)`, the body — unchanged. If `Proposal`/`AccessDecision` are already imported in the file, reuse them; avoid duplicate imports.)

- [ ] **Step 3: Remove `ViewerGate` from the entity model.** In `src/entities/proposal/model/types.ts`, delete the `ViewerGate` type block (and any now-unused `AccessDecision`/`Proposal` import that existed ONLY for it — keep imports still used by other types in the file). Confirm the entity barrel never re-exported `ViewerGate` (it doesn't).

- [ ] **Step 4: Repoint the 6 fn importers** to `@/shared/access/resolve-viewer-gate.server` (in `get-viewer-variants.server.ts` this changes the relative `./resolve-viewer-gate.server` → `@/shared/access/resolve-viewer-gate.server`). Grep to confirm:

```bash
grep -rn "entities/proposal/api/resolve-viewer-gate\|model/types\".*ViewerGate" src app tests   # expect NO stale gate path
grep -rln "resolve-viewer-gate" src app   # every hit now @/shared/access/...
```

- [ ] **Step 5: Verify green.** `npx tsc --noEmit && npm run lint && npm run build` → PASS (27 routes). `grep -rn "@/legacy" src/shared/access/resolve-viewer-gate.server.ts` → empty.

- [ ] **Step 6: Format + commit.**

```bash
npx prettier --write src/shared/access/resolve-viewer-gate.server.ts src/entities/proposal/model/types.ts src/entities/proposal/api/get-viewer-variants.server.ts "app/api/p/[publicId]/chat/route.ts" "app/api/p/[publicId]/pins/route.ts" "app/api/p/[publicId]/pins/[pinId]/route.ts" "app/p/[publicId]/layout.tsx" "app/p/[publicId]/page.tsx"
git add -A
git commit -m "refactor: move resolveViewerGate + ViewerGate to shared/access (Stage 5b prep)"
```

---

### Task 2: `entities/chat-message` slice + thin `GET /api/p/[publicId]/chat`

**Files:**

- Create: `src/entities/chat-message/model/types.ts` (`ChatMessageDTO`)
- Create: `src/entities/chat-message/model/chat-schema.ts` (`MAX_CHAT_BODY`, `chatBodySchema`, `createChatInputSchema`, `CreateChatInput`)
- Create: `src/entities/chat-message/api/get-recent-chat.server.ts` (`getRecentChat`)
- Create: `src/entities/chat-message/api/get-recent-chat.ts` (client fetcher `getRecentChat`)
- Create: `src/entities/chat-message/api/chat.query.ts` (`chatQueries`)
- Create: `src/entities/chat-message/index.ts` (barrel — `chatQueries`, `fetchRecentChat`, `ChatMessageDTO`, `MAX_CHAT_BODY`)
- Create: `tests/entities/chat-message/chat-schema.test.ts` (pure-logic unit test for the new Zod schema — see Step 8.5)
- Create: `app/api/p/[publicId]/chat/route.ts` → ADD a `GET` export (the file already exists with `POST`; add `GET` alongside — do NOT remove the legacy `POST` yet, Task 3 rewrites it)
- Modify: `src/legacy/lib/meeting/types.ts` → becomes a re-export bridge (`export type { ChatMessageDTO } from "@/entities/chat-message"`) so legacy importers (provider, shell, load-chat) keep working until Task 4

> Additive: the entity + GET land without touching the live chat path (chat-panel still uses the provider). `ChatMessageDTO` moves to the entity with a legacy bridge to avoid repointing legacy importers this task.

- [ ] **Step 1: `model/types.ts`** — copy `ChatMessageDTO` verbatim from `src/legacy/lib/meeting/types.ts`:

```ts
export type ChatMessageDTO = {
  id: string;
  authorName: string;
  authorColor: string;
  body: string;
  createdAt: string; // ISO 8601
};
```

- [ ] **Step 2: `model/chat-schema.ts`** — Zod (replaces `validateChatBody` + clamps), `MAX_CHAT_BODY` client-safe-exported:

```ts
import { z } from "zod";

export const MAX_CHAT_BODY = 2000;

export const chatBodySchema = z.string().trim().min(1).max(MAX_CHAT_BODY);

export const createChatInputSchema = z.object({
  body: chatBodySchema,
  authorName: z.string().trim().min(1).max(80),
  authorColor: z.string().trim().min(1).max(32),
});
export type CreateChatInput = z.infer<typeof createChatInputSchema>;
```

> Behavior parity: old code 400s on empty/too-long body (`INVALID_BODY`) and on missing author (`INVALID_AUTHOR`); Zod `.parse` throwing a `ZodError` → `toErrorResponse` maps it to 400 `VALIDATION_ERROR`. **Documented divergences (both acceptable — clients only check `res.ok`):** (1) the two distinct 400 codes collapse to one 400; (2) the old POST SILENTLY TRUNCATED over-length author fields (`authorName.trim().slice(0,80)`, `authorColor.slice(0,32)`) and still inserted, whereas `.max(80)`/`.max(32)` now REJECT with a 400 — effectively unreachable because `authorName`/`authorColor` are client-generated guest-identity values bounded well under those limits, and the trust model is unchanged (`createChatMessage` takes the author from the parsed client input, never from `resolveViewerGate().viewer`).

- [ ] **Step 3: `api/get-recent-chat.server.ts`** — gated read (move `loadRecentChat` logic; gate from shared):

```ts
import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { chatMessages } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import type { ChatMessageDTO } from "../model/types";

const INITIAL_CHAT_LIMIT = 50;

export async function getRecentChat(publicId: string): Promise<ChatMessageDTO[]> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");

  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.proposalId, proposal.id))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(INITIAL_CHAT_LIMIT);
  return rows.reverse().map((r) => ({
    id: r.id,
    authorName: r.authorName,
    authorColor: r.authorColor,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  }));
}
```

- [ ] **Step 4: `api/get-recent-chat.ts`** (client fetcher):

```ts
import { http } from "@/shared/api/http";
import type { ChatMessageDTO } from "../model/types";

export function getRecentChat(publicId: string): Promise<ChatMessageDTO[]> {
  return http<ChatMessageDTO[]>(`/api/p/${publicId}/chat`);
}
```

- [ ] **Step 5: `api/chat.query.ts`**:

```ts
import { queryOptions } from "@tanstack/react-query";
import { getRecentChat } from "./get-recent-chat";

export const chatQueries = {
  all: () => ["chat"] as const,
  list: (publicId: string) =>
    queryOptions({
      queryKey: [...chatQueries.all(), "list", publicId],
      queryFn: () => getRecentChat(publicId),
    }),
};
```

- [ ] **Step 6: `index.ts` barrel** (client-safe only — NOT the `.server` file):

```ts
export { chatQueries } from "./api/chat.query";
export { getRecentChat as fetchRecentChat } from "./api/get-recent-chat";
export type { ChatMessageDTO } from "./model/types";
export { MAX_CHAT_BODY, createChatInputSchema, type CreateChatInput } from "./model/chat-schema";
```

- [ ] **Step 7: ADD a thin `GET` to the chat route** — in `app/api/p/[publicId]/chat/route.ts`, add (keep the existing `POST` untouched this task):

```ts
import { getRecentChat } from "@/entities/chat-message/api/get-recent-chat.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET(_req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    return Response.json(await getRecentChat(publicId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 8: `ChatMessageDTO` bridge** — replace the body of `src/legacy/lib/meeting/types.ts` with `export type { ChatMessageDTO } from "@/entities/chat-message";` (keep the comment). This keeps the provider/shell/load-chat imports green until Task 4.

- [ ] **Step 8.5: Unit-test the new Zod schema** (pure logic — repo TDD convention; mirror `tests/meeting/chat.test.ts`'s style). `tests/entities/chat-message/chat-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createChatInputSchema, chatBodySchema, MAX_CHAT_BODY } from "@/entities/chat-message";

describe("chatBodySchema", () => {
  it("trims and accepts 1..MAX", () => {
    expect(chatBodySchema.parse("  hi  ")).toBe("hi");
    expect(chatBodySchema.parse("a".repeat(MAX_CHAT_BODY))).toHaveLength(MAX_CHAT_BODY);
  });
  it("rejects empty / whitespace-only / too long", () => {
    expect(chatBodySchema.safeParse("   ").success).toBe(false);
    expect(chatBodySchema.safeParse("").success).toBe(false);
    expect(chatBodySchema.safeParse("a".repeat(MAX_CHAT_BODY + 1)).success).toBe(false);
  });
});

describe("createChatInputSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      createChatInputSchema.parse({ body: "hi", authorName: "n", authorColor: "#fff" }),
    ).toEqual({ body: "hi", authorName: "n", authorColor: "#fff" });
  });
  it("rejects missing/over-length author fields", () => {
    expect(
      createChatInputSchema.safeParse({ body: "hi", authorName: "", authorColor: "#fff" }).success,
    ).toBe(false);
    expect(
      createChatInputSchema.safeParse({
        body: "hi",
        authorName: "a".repeat(81),
        authorColor: "#fff",
      }).success,
    ).toBe(false);
  });
});
```

> The legacy `tests/meeting/chat.test.ts` (for `validateChatBody`) stays this stage — `chat.ts` is not deleted in 5b — so this is purely additive (+~4 cases). It moves/replaces the legacy test in 5c when `chat.ts` is removed.

- [ ] **Step 9: Verify + commit.** `npx tsc --noEmit && npm run lint && npm test && npm run build` → PASS; the new `chat-schema` test passes (test count rises by the ~4 new cases); build shows `GET` added to `/api/p/[publicId]/chat` (still 27 routes — same path, +1 method). `grep -rn "@/legacy" src/entities/chat-message` → empty.

```bash
npx prettier --write src/entities/chat-message tests/entities/chat-message "app/api/p/[publicId]/chat/route.ts" src/legacy/lib/meeting/types.ts
git add -A
git commit -m "feat: entities/chat-message + thin GET /api/p/[publicId]/chat (Stage 5b)"
```

---

### Task 3: `features/send-chat-message` + rewrite the POST route thin

**Files:**

- Create: `src/features/send-chat-message/api/create-chat-message.server.ts` (`createChatMessage`)
- Create: `src/features/send-chat-message/api/use-send-chat-message.ts` (`useSendChatMessage` hook)
- Create: `src/features/send-chat-message/index.ts`
- Modify: `app/api/p/[publicId]/chat/route.ts` (rewrite `POST` thin via `createChatMessage`)

> The send mutation lives in the feature; it posts + updates the RQ cache. The **broadcast** is NOT in the feature (a feature must not import the legacy provider) — Task 4 wires `broadcastChat` in the legacy chat-panel after the mutation resolves. The POST keeps returning `{ message: ChatMessageDTO }` (same shape the still-live legacy chat-panel reads, until Task 4).

- [ ] **Step 1: `create-chat-message.server.ts`** — gated insert (replaces the route's inline logic):

```ts
import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { chatMessages } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { createChatInputSchema } from "@/entities/chat-message";
import type { ChatMessageDTO } from "@/entities/chat-message";

export async function createChatMessage(publicId: string, raw: unknown): Promise<ChatMessageDTO> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");

  const { body, authorName, authorColor } = createChatInputSchema.parse(raw);

  const id = randomUUID();
  const createdAt = new Date();
  await db
    .insert(chatMessages)
    .values({ id, proposalId: proposal.id, authorName, authorColor, body, createdAt });
  return { id, authorName, authorColor, body, createdAt: createdAt.toISOString() };
}
```

> `createChatInputSchema` (Task 2) is in the entity model — a feature importing an entity schema is allowed (feature > entity). The Zod parse replaces `validateChatBody` + the author clamps; `.trim()`/`.max()` preserve the old clamping intent.

- [ ] **Step 2: `use-send-chat-message.ts`** (client mutation; cache append, no broadcast here):

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import { chatQueries, type ChatMessageDTO, type CreateChatInput } from "@/entities/chat-message";

export function useSendChatMessage(publicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChatInput) =>
      http<{ message: ChatMessageDTO }>(`/api/p/${publicId}/chat`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.message),
    onSuccess: (message) => {
      qc.setQueryData<ChatMessageDTO[]>(chatQueries.list(publicId).queryKey, (prev) =>
        prev && prev.some((m) => m.id === message.id) ? prev : [...(prev ?? []), message],
      );
    },
  });
}
```

> Verify `http`'s signature (method/body options + JSON handling) against `src/shared/api/http.ts` and match it exactly (other features' mutations are the reference).

- [ ] **Step 3: `index.ts`**:

```ts
export { useSendChatMessage } from "./api/use-send-chat-message";
```

- [ ] **Step 4: Rewrite the `POST`** in `app/api/p/[publicId]/chat/route.ts` thin (keep the `GET` from Task 2):

```ts
import { createChatMessage } from "@/features/send-chat-message/api/create-chat-message.server";
// ...
export async function POST(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const raw = await req.json().catch(() => null); // preserve old 4xx-on-malformed-body: null → ZodError → 400 (not a 500 SyntaxError)
    const message = await createChatMessage(publicId, raw);
    return Response.json({ message });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

> `.catch(() => null)` preserves the legacy behavior: a malformed/empty body becomes `null` → `createChatInputSchema.parse(null)` throws a `ZodError` → `toErrorResponse` → 400, instead of an unhandled `SyntaxError` → 500.
> Remove the now-unused route imports (`NextRequest`/`NextResponse`, `db`, `chatMessages`, `randomUUID`, legacy `validateChatBody`, legacy `ChatMessageDTO`, the `resolveViewerGate` direct use if only POST used it — keep it if GET... GET uses `getRecentChat` not the gate directly, so the route no longer imports `resolveViewerGate`). Confirm no dead imports.

- [ ] **Step 5: Verify + commit.** `npx tsc --noEmit && npm run lint && npm run build` → PASS. The legacy chat-panel still works (POST still returns `{ message }`). `grep -rn "@/legacy" src/features/send-chat-message` → empty.

```bash
npx prettier --write src/features/send-chat-message "app/api/p/[publicId]/chat/route.ts"
git add -A
git commit -m "feat: features/send-chat-message + thin POST /api/p/[publicId]/chat (Stage 5b)"
```

---

### Task 4: Flip chat to React Query — chat-panel + provider relay surgery + drop `initialChat`

**Files:**

- Modify: `src/legacy/components/realtime/chat-panel.tsx` (useQuery + useSendChatMessage + subscribeChat bridge + broadcastChat)
- Modify: `src/legacy/components/realtime/realtime-provider.tsx` (chat → relay-only)
- Modify: `src/legacy/components/realtime/realtime-shell.tsx` (drop `initialChat` prop + pass-through)
- Modify: `app/p/[publicId]/layout.tsx` (drop `loadRecentChat` + `initialChat`)
- Delete: `src/legacy/lib/meeting/load-chat.ts`, `src/legacy/lib/meeting/types.ts` (the bridge — repoint its remaining importers to `@/entities/chat-message`)
- **Do NOT delete `src/legacy/lib/meeting/chat.ts`** this stage — `validateChatBody`/`MAX_CHAT_BODY` are still imported by the two **pins** routes (`app/api/p/[publicId]/pins/route.ts`, `pins/[pinId]/route.ts`) and `tests/meeting/chat.test.ts`, all OUT of 5b scope. `chat.ts` is deleted in **5c** when pins migrate (the pins routes adopt the entity/shared body schema then). The chat-panel still drops its `MAX_CHAT_BODY` import from `chat.ts` → `@/entities/chat-message` (Step 2), so chat itself has no legacy edge after 5b.

> This is the cutover. All chat data now flows through React Query; the provider relays live messages into the cache. Manual realtime E2E matters here. (Legacy `chat.ts` survives — it's pin-shared until 5c.)

- [ ] **Step 1: Provider — chat becomes relay-only** (mirror the pin pattern). In `realtime-provider.tsx`:
  - Remove the `initialChat` prop (signature becomes `{ publicId, identity, children }`).
  - Remove `const [chatMessages, setChatMessages] = useState<ChatMessageDTO[]>(initialChat);`.
  - Add `const chatSubsRef = useRef(new Set<(m: ChatMessageDTO) => void>());` (next to `pinSubsRef`).
  - Change the `"chat"` broadcast handler: instead of `setChatMessages(...)`, fan out: `if (!m?.id) return; chatSubsRef.current.forEach((h) => h(m));`.
  - Replace `sendChat` with `broadcastChat` (send only, mirror `broadcastPin`): `const broadcastChat = useCallback((message: ChatMessageDTO) => { const ch = channelRef.current; if (ch?.state === "joined") ch.send({ type: "broadcast", event: "chat", payload: message }); }, []);`.
  - Add `const subscribeChat = useCallback((handler) => { chatSubsRef.current.add(handler); return () => { chatSubsRef.current.delete(handler); }; }, []);`.
  - Update the context value type + object: remove `chatMessages` + `sendChat`; add `subscribeChat` + `broadcastChat`.
  - Repoint `import type { ChatMessageDTO } from "@/legacy/lib/meeting/types"` → `@/entities/chat-message`.

- [ ] **Step 2: chat-panel — read/send via React Query.** In `chat-panel.tsx`:
  - Replace `const { chatMessages, sendChat } = useRealtime();` with: `const { subscribeChat, broadcastChat } = useRealtime();` + `const { data: chatMessages = [] } = useQuery(chatQueries.list(publicId));` + `const qc = useQueryClient();` + `const sendChat = useSendChatMessage(publicId);`.
  - Bridge incoming: `useEffect(() => subscribeChat((m) => qc.setQueryData<ChatMessageDTO[]>(chatQueries.list(publicId).queryKey, (prev) => prev && prev.some((x) => x.id === m.id) ? prev : [...(prev ?? []), m])), [subscribeChat, qc, publicId]);`.
  - Rewrite `submit`: call `sendChat.mutate({ body, authorName: identity.name, authorColor: identity.color }, { onSuccess: (message) => { broadcastChat(message); setText(""); }, onError: () => setFailed(true) })`. Replace the local `sending`/`failed` state with `sendChat.isPending`/`sendChat.isError` (or keep `failed` driven by onError) — keep the UI identical.
  - Imports: `useQuery`, `useQueryClient` from `@tanstack/react-query`; `chatQueries`, `MAX_CHAT_BODY`, `type ChatMessageDTO` from `@/entities/chat-message`; `useSendChatMessage` from `@/features/send-chat-message`. Drop the legacy `MAX_CHAT_BODY` import + the raw `fetch`.
  - Preserve: the scroll-to-bottom effect (now keyed on the RQ `chatMessages`), the open/close UI, the unread count, `maxLength={MAX_CHAT_BODY}`.

- [ ] **Step 3: RealtimeShell — drop `initialChat`.** In `realtime-shell.tsx`: remove the `initialChat` prop from the signature + the `<RealtimeProvider>` call; remove the `ChatMessageDTO` import.

- [ ] **Step 4: layout — drop the SSR chat load.** In `app/p/[publicId]/layout.tsx`: remove `import { loadRecentChat }`, the `const initialChat = await loadRecentChat(...)` line, and the `initialChat={initialChat}` prop. (The gate + `RealtimeShell` mount logic is otherwise unchanged.)

- [ ] **Step 5: Delete the moved chat libs (NOT `chat.ts`) + repoint stragglers.**

```bash
git rm src/legacy/lib/meeting/load-chat.ts src/legacy/lib/meeting/types.ts   # keep chat.ts (pin-shared until 5c)
grep -rn "lib/meeting/load-chat\|lib/meeting/types\|loadRecentChat" src app tests   # expect NO output (these are gone)
```

(If any straggler imports `ChatMessageDTO` from `lib/meeting/types` — repoint it to `@/entities/chat-message`. Do NOT `rmdir src/legacy/lib/meeting/` — `chat.ts` remains. `validateChatBody`/`MAX_CHAT_BODY` will still appear in greps via the pins routes + `chat.test` — that is expected this stage.)

- [ ] **Step 6: Verify green.** `npx tsc --noEmit && npm run lint && npm run build` → PASS (still 27 routes). `grep -rn "chatMessages\|sendChat\b" src/legacy/components/realtime/realtime-provider.tsx` → only the relay refs remain (no `useState` ownership). `grep -rn "@/legacy/lib/meeting/load-chat\|@/legacy/lib/meeting/types" src app tests` → empty (chat.ts importers — pins routes + chat.test — legitimately remain).

- [ ] **Step 7: Manual realtime E2E (if a session + Supabase env).** Two browsers on `/p/<publicId>` (public proposal): open chat in both → initial history loads (RQ); send from A → appears in A (mutation `setQueryData`) AND in B (broadcast → `subscribeChat` → cache); reload B → history persists (GET). Confirm cursors/presence/pins still work (untouched). If no env, rely on tsc/lint/build + note it.

- [ ] **Step 8: Format + commit.**

```bash
npx prettier --write src/legacy/components/realtime/chat-panel.tsx src/legacy/components/realtime/realtime-provider.tsx src/legacy/components/realtime/realtime-shell.tsx "app/p/[publicId]/layout.tsx"
git add -A
git commit -m "feat: chat on React Query (provider relay + setQueryData bridge); drop legacy chat libs (Stage 5b)"
```

---

### Task 5: Stage 5b verification gate + handoff

**Files:** `docs/superpowers/HANDOFF.md` (rest is verification only).

- [ ] **Step 1: Full green gate.** `npx tsc --noEmit && npm run lint && npm test && npm run build` → all PASS. Report the test count: expect **128 + the ~4 new `chat-schema` cases** (the legacy `tests/meeting/chat.test.ts` for `validateChatBody` STAYS this stage — `chat.ts` is not deleted in 5b — so nothing is removed; only the new schema test is added). Route count **27** (`GET`+`POST` on `/api/p/[publicId]/chat`).

- [ ] **Step 2: Migration correctness greps.**

```bash
grep -rn "@/legacy" src/entities/chat-message src/features/send-chat-message   # expect empty
grep -rn "@/legacy/lib/meeting/load-chat\|@/legacy/lib/meeting/types\|loadRecentChat" src app tests   # expect empty (deleted)
grep -rn "@/legacy/lib/meeting/chat\b" src app tests   # NOT empty — chat.ts stays for the pins routes + chat.test until 5c (expected)
grep -rn "initialChat" src/legacy/components/realtime app/p   # expect empty (dropped)
grep -rn "chatMessages\s*=\s*useState\|setChatMessages" src   # expect empty (provider no longer owns chat)
grep -rn "\.server\"" src/entities/chat-message/index.ts src/features/send-chat-message/index.ts   # expect empty (no server fn in barrels)
grep -rn "resolve-viewer-gate" src app | grep -v "@/shared/access"   # expect empty (all gate imports now shared)
```

- [ ] **Step 3: Data/session seam check (structural).** Confirm: `getRecentChat` + `createChatMessage` both gate via `@/shared/access/resolve-viewer-gate.server` (allow-only, 403/404 on deny); the provider's `"chat"` handler fans out to `chatSubsRef` (no `setChatMessages`); chat-panel reads `useQuery(chatQueries.list)` + bridges `subscribeChat` → `setQueryData` + sends via `useSendChatMessage` then `broadcastChat`. Pins (`subscribePins`/`broadcastPin*`) + cursors + presence in the provider are unchanged.

- [ ] **Step 4: Update the handoff.** Add a Stage 5b "Done" entry: `resolveViewerGate` + `ViewerGate` → `shared/access` (6 importers repointed); `entities/chat-message` (DTO + Zod `MAX_CHAT_BODY`/`createChatInputSchema` + `getRecentChat` gated read + `chatQueries.list` + client fetcher); `features/send-chat-message` (`createChatMessage` gated insert + `useSendChatMessage`); thin gated `GET`+`POST /api/p/[publicId]/chat`; chat now on React Query — the provider relays `"chat"` broadcasts via `subscribeChat`/`broadcastChat` (mirroring pins) and the chat-panel bridges them to `setQueryData`; `initialChat` SSR load dropped (layout + shell + provider); legacy `lib/meeting/{load-chat,chat,types}` deleted. Note what stays in legacy for 5c/5d: the provider (cursors/presence + pin relay + chat relay), chat-panel/presence-bar (move to `widgets/realtime-shell` in 5d), `lib/pins/{use-pins,load-pins,types}` (5c). Update test/route counts. Set next = **Stage 5c (pin data)**. Commit:

```bash
npx prettier --write docs/superpowers/HANDOFF.md
git add docs/superpowers/HANDOFF.md
git commit -m "docs: handoff — Stage 5b done (chat on React Query), next = 5c pins"
```

---

## Self-Review (completed by author)

- **Spec coverage:** chat data → React Query (entity read + GET, feature mutation + thin POST), realtime relay seam (`subscribeChat`/`broadcastChat` → `setQueryData`), gate→shared prep, `initialChat` SSR removed. Pins/cursors/presence/provider-promotion untouched (5c/5d).
- **Green-at-commit:** T1 repoints all 6 gate importers; T2 is additive (+ a `ChatMessageDTO` bridge so legacy keeps compiling); T3 keeps the POST `{message}` shape so the still-live legacy chat-panel works; T4 is the atomic cutover (chat-panel + provider + shell + layout + legacy-delete together).
- **Layering:** entity/feature never import `@/legacy`; the broadcast wiring lives in the legacy chat-panel (provider access), not the feature; barrels export no `.server`. Gate is now a shared cross-cutting primitive (no entity→entity edge for the chat read).
- **Behavior parity:** last-50 oldest→newest, `self:false` local append on send, malformed-payload drop, `MAX_CHAT_BODY` input bound + server re-validate. Documented divergence: two 400 sub-codes collapse to one Zod 400; chat initial load is now client-side (brief loading).
- **No placeholders:** all code concrete; `http` signature to be matched against the real `shared/api/http.ts`; `setQueryData` keyed off `chatQueries.list(publicId).queryKey`.
- **Risk:** medium — the provider surgery + the cache-bridge are the real risk; mitigated by mirroring the existing, proven pin relay pattern and by the manual E2E in T4. tsc/lint/build catch wiring errors; realtime correctness needs the E2E.

**Adversarial audit (4 lenses, blocker/high refute-verified):** one real root-cause defect fixed (flagged by all 4 lenses) — Task 4 deleted legacy `chat.ts`, but `validateChatBody`/`MAX_CHAT_BODY` are **also** used by the two out-of-scope **pins** routes + `tests/meeting/chat.test.ts`, so deleting it in 5b breaks `tsc`/`build`/`test` at the Task-4 commit. **Fix: `chat.ts` is NOT deleted in 5b** (only `load-chat.ts` + the `types.ts` bridge); `chat.ts` removal + the pins-body-validation migration + the legacy `chat.test` replacement move to **5c**. Also fixed two minor behavior regressions: the thin POST now does `req.json().catch(() => null)` (preserves 400-on-malformed-body instead of 500); and the author truncate→reject divergence is documented. Added a `chat-schema` unit test (new Zod is pure logic).

## Next: Stage 5c (pin data)

`entities/pin` (PinDTO/PinEvent/PinContext + Zod, `get-pins.server.ts` gated read, `getPins` fetcher, `pinQueries` keyed by publicId+variantId+versionId) replacing the `use-pins` load; `features/pin-comment` (create/edit/resolve/delete mutations → thin rewritten routes; gate asymmetry read=allow / write=allow+login / edit-delete=author-only, PATCH XOR; optimistic `setQueryData`, `self:false` broadcast, `myColor` passed explicitly). Removes the widget→legacy `use-pins`/`lib/pins/types` edges. **5c also finishes the chat cleanup deferred from 5b:** migrate the two pins routes' body validation off legacy `validateChatBody` (to the entity/shared body schema), then delete `src/legacy/lib/meeting/chat.ts` + replace `tests/meeting/chat.test.ts` with the entity `chat-schema` test (already added in 5b — so 5c just removes the legacy one), and `rmdir src/legacy/lib/meeting/`. Provider keeps only cursors/presence + the relay helpers until 5d.
