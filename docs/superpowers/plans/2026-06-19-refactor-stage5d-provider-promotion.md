# Refactor Stage 5d — Promote RealtimeProvider → `shared/realtime` + finalize `widgets/realtime-shell`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The final substage of Stage 5. Promote the realtime `RealtimeProvider` out of `src/legacy` into `shared/realtime`, and relocate the realtime shell + its presence/chat segments into a new `widgets/realtime-shell`. After 5d there is **zero `@/legacy` realtime dependency** anywhere — the viewer page, the editor preview, and `widgets/preview-canvas` all reach realtime via `shared/realtime` + `widgets/realtime-shell`. `src/legacy/components/realtime/` is deleted.

**The layering decision (why the provider becomes generic):** the provider currently relays domain payloads (`ChatMessageDTO`, `PinDTO`/`PinEvent`) and therefore imports `@/entities/*`. Moving it to `shared/realtime` would make that a **shared → entities upward import (FSD violation)**. Resolution: the Supabase channel is a **generic transport** — the provider relays **opaque payloads** (`unknown`) and exposes generic broadcast/subscribe helpers; the **domain typing stays with the consumers** (the widgets `chat-panel`/`pin-layer`, which may import entities). This is the correct end-state of the data/session seam: session state (channel/presence/cursors/identity) + a generic relay live in `shared/realtime`; the entity DTOs are cast at the consumer boundary.

**Architecture after 5d:**
- `shared/realtime/realtime-provider.tsx` — the Context provider: presence (`participants`), live cursors (`cursors`/`sendCursor`/`clearCursor`), `myColor`, and a **generic relay** (`subscribeChat`/`broadcastChat`, `subscribePins`/`broadcastPin*`) with `unknown` payloads + a shared generic `PinEvent` (`pin: unknown`). Imports only `@/shared/*` (supabase client, channel, identity) — NO `@/entities`, NO `@/legacy`.
- `widgets/realtime-shell/` — `RealtimeShell` (mounts the provider + identity) + `chat-panel` + `presence-bar` segments. Imports `@/shared/realtime/realtime-provider`, `@/entities/chat-message`, `@/features/send-chat-message`, `@/shared/ui`. The chat-panel casts the relayed payload to `ChatMessageDTO`.
- `widgets/preview-canvas/ui/{canvas-cursors,pin-layer}.tsx` — repoint `useRealtimeOptional` from `@/legacy/...` → `@/shared/realtime/realtime-provider` (the last transient edges removed). `pin-layer` casts the relayed `PinEvent.pin` to `PinDTO`.
- `app/p/[publicId]/layout.tsx` — imports `RealtimeShell` from `@/widgets/realtime-shell` (was `@/legacy`).

**Tech Stack:** Next.js 16, React 19, `@supabase/supabase-js` (Realtime channel: presence + broadcast), `@tanstack/react-query` v5 (consumers only — untouched here). Node ≥22.

**Source:** Stage 5 cluster map + decomposition (Option B, user-approved 2026-06-19). Builds on 5a/5b/5c. Handoff: `docs/superpowers/HANDOFF.md`.

## Global Constraints

- **Node ≥22** (active, v22.18.0 — do not switch).
- **FSD layer order:** `shared < entities < features < widgets < pages < app`. `shared/realtime/realtime-provider.tsx` must import ONLY `@/shared/*` — **NO `@/entities`, NO `@/features`, NO `@/legacy`** (this is the whole point of the generic relay). `widgets/realtime-shell` + `widgets/preview-canvas` may import `@/shared`/`@/entities`/`@/features` (downward).
- **No widget→widget import:** the provider lives in `shared` (not `widgets/realtime-shell`) precisely so `widgets/preview-canvas` (canvas-cursors/pin-layer) can import it from `shared` without a same-layer widget→widget edge.
- **Behavior preservation (realtime must keep working):** the channel subscription, presence sync, cursor broadcast (`self:false`, joined-guard, RAF throttle), and the chat/pin relay fan-out are **byte-equivalent** — only the payload TYPES change (`ChatMessageDTO`/`PinDTO` → `unknown`, cast at consumers) and the file LOCATIONS change. The channel still mounts at the layout (survives `?v=`/`?compare=`). The `!m?.id` / `!pin?.id` runtime guards stay. The editor preview stays provider-less (`useRealtimeOptional` null-safe).
- **Green at every commit.** Task 1 moves the provider + repoints ALL its importers (incl. the still-legacy shell/presence/chat) in one commit; Task 2 moves the shell + segments + repoints the layout + deletes the legacy dir. Verify `tsc --noEmit` + `lint` + `test` + `build`. Greps scope `src app tests`.
- **One commit per task.** Prettier-format touched/new files (quote bracketed paths).

### Verified current facts

- `realtime-provider.tsx` context value: `participants`, `cursors`, `sendCursor`, `clearCursor`, `chatMessages`?(NO — removed in 5b), `myColor`, `subscribeChat`, `broadcastChat`, `subscribePins`, `broadcastPin`, `broadcastPinUpdated`, `broadcastPinDeleted`. (Chat/pin DATA already in React Query.) It imports `@/shared/supabase/client`, `@/shared/realtime/channel` (`channelName`), `@/shared/realtime/identity` (`Identity` type), `@/entities/chat-message` (`ChatMessageDTO` — REMOVE), `@/entities/pin` (`PinDTO`, `PinEvent` — REMOVE). `Participant`/`RemoteCursor` are defined IN the provider.
- Provider importers: `realtime-shell.tsx` (`RealtimeProvider`), `presence-bar.tsx` (`useRealtime` → `participants`), `chat-panel.tsx` (`useRealtime` → `subscribeChat`/`broadcastChat`), `widgets/preview-canvas/ui/canvas-cursors.tsx` (`useRealtimeOptional` → `cursors`/`sendCursor`/`clearCursor`), `widgets/preview-canvas/ui/pin-layer.tsx` (`useRealtimeOptional` → `subscribePins`/`broadcastPin*`/`myColor`).
- `realtime-shell.tsx`: takes `{ publicId, editorName, children }`; mounts `<RealtimeProvider>` + renders `children` + `<PresenceBar>` + `<ChatPanel>`; identity via `loadOrCreateIdentity`/`saveIdentity` (`@/shared/realtime/identity`).
- `chat-panel.tsx` (widget-ready): `useRealtime().subscribeChat/broadcastChat` + `useQuery(chatQueries.list)` + `useSendChatMessage` + casts; imports `@/entities/chat-message`, `@/features/send-chat-message`, `@/shared/ui/*`, `@/shared/realtime/identity` (type).
- `presence-bar.tsx`: `useRealtime().participants` + `@/shared/realtime/identity` (type) + `@/shared/ui/*`.
- `RealtimeShell` consumer: `app/p/[publicId]/layout.tsx` (imports from `@/legacy/components/realtime/realtime-shell`).
- After 5c, `src/legacy/components/realtime/` contains exactly: `realtime-provider.tsx`, `realtime-shell.tsx`, `chat-panel.tsx`, `presence-bar.tsx`. (`canvas-cursors` moved to the widget in 5a.)

---

### Task 1: Promote `RealtimeProvider` → `shared/realtime` (generic relay)

**Files:**
- Move: `src/legacy/components/realtime/realtime-provider.tsx` → `src/shared/realtime/realtime-provider.tsx`
- Modify: `src/legacy/components/realtime/realtime-shell.tsx`, `presence-bar.tsx`, `chat-panel.tsx` (repoint provider import to `@/shared/realtime/realtime-provider` — they still live in legacy until Task 2; legacy→shared is allowed)
- Modify: `src/widgets/preview-canvas/ui/canvas-cursors.tsx`, `src/widgets/preview-canvas/ui/pin-layer.tsx` (repoint `useRealtimeOptional` import → `@/shared/realtime/realtime-provider`; add payload casts)

- [ ] **Step 1: Move the provider.**
```bash
git mv src/legacy/components/realtime/realtime-provider.tsx src/shared/realtime/realtime-provider.tsx
```

- [ ] **Step 2: Generic-ize the relay (remove entity imports).** In `src/shared/realtime/realtime-provider.tsx`:
  - Delete `import type { ChatMessageDTO } from "@/entities/chat-message";` and `import type { PinDTO, PinEvent } from "@/legacy/lib/pins/types";` / `"@/entities/pin";` (whichever it currently is).
  - Define the relay event type locally (generic/opaque):
    ```ts
    // The channel is a generic transport — the relayed payloads are opaque here;
    // consumers (chat-panel / pin-layer) cast them to their entity DTOs.
    export type PinEvent =
      | { type: "pin"; pin: unknown }
      | { type: "pin_updated"; pin: unknown }
      | { type: "pin_deleted"; id: string };
    ```
  - Change the context value type:
    - `subscribeChat: (handler: (message: unknown) => void) => () => void;`
    - `broadcastChat: (message: unknown) => void;`
    - `subscribePins: (handler: (e: PinEvent) => void) => () => void;`
    - `broadcastPin: (pin: unknown) => void;` `broadcastPinUpdated: (pin: unknown) => void;` `broadcastPinDeleted: (id: string) => void;`
  - In the `"chat"` broadcast handler keep the runtime guard but typed loosely: `const m = payload as { id?: string }; if (!m?.id) return; chatSubsRef.current.forEach((h) => h(payload));` (fan the raw `payload`).
  - In the `"pin"`/`"pin_updated"` handlers: `const p = payload as { id?: string }; if (!p?.id) return; pinSubsRef.current.forEach((h) => h({ type: "pin"|"pin_updated", pin: payload }));`. `"pin_deleted"`: unchanged (`{ type: "pin_deleted", id }`).
  - `chatSubsRef`/`pinSubsRef` element types become `(m: unknown) => void` / `(e: PinEvent) => void`.
  - Everything else (channel creation, presence sync, cursor broadcast/handlers, `sendCursor`/`clearCursor`, `subscribe*`/`broadcast*` send bodies, `useRealtime`/`useRealtimeOptional`, `Participant`/`RemoteCursor` defs) is UNCHANGED.
  - Confirm the imports are now ONLY: `react`, `@supabase/supabase-js` (type), `@/shared/supabase/client`, `@/shared/realtime/channel`, `@/shared/realtime/identity`.

- [ ] **Step 3: Repoint the still-legacy importers** (they stay in legacy until Task 2): in `src/legacy/components/realtime/{realtime-shell,presence-bar,chat-panel}.tsx` change the provider import (`./realtime-provider`) → `@/shared/realtime/realtime-provider`.

- [ ] **Step 4: Repoint + cast the widget consumers.**
  - `src/widgets/preview-canvas/ui/canvas-cursors.tsx`: change `import { useRealtimeOptional } from "@/legacy/components/realtime/realtime-provider"` → `@/shared/realtime/realtime-provider`. (No cast needed — it only reads `cursors`/`sendCursor`/`clearCursor`, which are unchanged.)
  - `src/widgets/preview-canvas/ui/pin-layer.tsx`: change the `useRealtimeOptional` import → `@/shared/realtime/realtime-provider`. The bridge handler now receives `PinEvent` with `pin: unknown` — cast inside: after the `pin_deleted` branch, `const p = e.pin as PinDTO;` then proceed (the existing `p.variantId`/`p.versionId`/`p.id` logic). `PinDTO` is already imported from `@/entities/pin` in pin-layer.
  - `src/legacy/components/realtime/chat-panel.tsx`: its `subscribeChat((m) => ...)` handler now receives `unknown` — cast: `subscribeChat((raw) => { const m = raw as ChatMessageDTO; ... })`. `ChatMessageDTO` is already imported there.

- [ ] **Step 5: Verify green + layering.**
```bash
npx tsc --noEmit && npm run lint && npm test && npm run build   # PASS (139 tests, 27 routes)
grep -rn "@/entities\|@/features\|@/legacy" src/shared/realtime/realtime-provider.tsx   # expect NO output (provider is pure shared)
grep -rn "@/legacy" src/widgets/preview-canvas   # ONLY canvas-cursors + pin-layer? NO — they're now @/shared; expect EMPTY (legacy edge gone)
```
(After this task, `widgets/preview-canvas` has ZERO `@/legacy` — the canvas-cursors/pin-layer transient edges are removed. The still-legacy shell/presence/chat now import the provider from `@/shared`.)

- [ ] **Step 6: Format + commit.**
```bash
npx prettier --write src/shared/realtime/realtime-provider.tsx src/legacy/components/realtime/realtime-shell.tsx src/legacy/components/realtime/presence-bar.tsx src/legacy/components/realtime/chat-panel.tsx src/widgets/preview-canvas/ui/canvas-cursors.tsx src/widgets/preview-canvas/ui/pin-layer.tsx
git add -A
git commit -m "refactor: promote RealtimeProvider to shared/realtime (generic relay); drop widget->legacy edges (Stage 5d)"
```

---

### Task 2: Relocate the shell + segments → `widgets/realtime-shell`; repoint the layout

**Files:**
- Move: `src/legacy/components/realtime/realtime-shell.tsx` → `src/widgets/realtime-shell/ui/realtime-shell.tsx`
- Move: `src/legacy/components/realtime/chat-panel.tsx` → `src/widgets/realtime-shell/ui/chat-panel.tsx`
- Move: `src/legacy/components/realtime/presence-bar.tsx` → `src/widgets/realtime-shell/ui/presence-bar.tsx`
- Create: `src/widgets/realtime-shell/index.ts` (`export { RealtimeShell } from "./ui/realtime-shell";`)
- Modify: `app/p/[publicId]/layout.tsx` (repoint `RealtimeShell` import → `@/widgets/realtime-shell`)
- Delete (empty after move): `src/legacy/components/realtime/`

- [ ] **Step 1: Move the three files.**
```bash
mkdir -p src/widgets/realtime-shell/ui
git mv src/legacy/components/realtime/realtime-shell.tsx src/widgets/realtime-shell/ui/
git mv src/legacy/components/realtime/chat-panel.tsx src/widgets/realtime-shell/ui/
git mv src/legacy/components/realtime/presence-bar.tsx src/widgets/realtime-shell/ui/
```

- [ ] **Step 2: Fix internal imports in the moved files.**
  - `realtime-shell.tsx`: `./presence-bar` + `./chat-panel` stay relative (same dir). The provider import is `@/shared/realtime/realtime-provider` (already repointed in Task 1). `@/shared/realtime/identity` unchanged.
  - `chat-panel.tsx` / `presence-bar.tsx`: their imports (`@/shared/realtime/realtime-provider`, `@/entities/chat-message`, `@/features/send-chat-message`, `@/shared/ui/*`, `@/shared/realtime/identity`) are all absolute `@/...` — no relative-path fixes needed.

- [ ] **Step 3: Create the widget barrel** `src/widgets/realtime-shell/index.ts`:
```ts
export { RealtimeShell } from "./ui/realtime-shell";
```

- [ ] **Step 4: Repoint the layout.** In `app/p/[publicId]/layout.tsx`: `import { RealtimeShell } from "@/legacy/components/realtime/realtime-shell";` → `import { RealtimeShell } from "@/widgets/realtime-shell";`.

- [ ] **Step 5: Delete the emptied legacy dir + guard.**
```bash
grep -rn "@/legacy/components/realtime" src app tests   # expect NO output (all moved/repointed)
ls -A src/legacy/components/realtime 2>/dev/null   # expect empty / gone
rmdir src/legacy/components/realtime 2>/dev/null || true
```

- [ ] **Step 6: Verify green + the realtime-legacy-gone invariant.**
```bash
npx tsc --noEmit && npm run lint && npm test && npm run build   # PASS (139 tests, 27 routes)
grep -rn "@/legacy" src/widgets/realtime-shell   # expect EMPTY (widget imports shared/entities/features only)
grep -rn "@/legacy/components/realtime\|RealtimeShell.*@/legacy" src app tests   # expect EMPTY
grep -rn "@/entities\|@/features\|@/legacy" src/shared/realtime/realtime-provider.tsx   # still EMPTY (pure shared)
```

- [ ] **Step 7: Format + commit.**
```bash
npx prettier --write src/widgets/realtime-shell "app/p/[publicId]/layout.tsx"
git add -A
git commit -m "refactor: relocate realtime-shell/chat-panel/presence-bar to widgets/realtime-shell (Stage 5d)"
```

---

### Task 3: Stage 5d (+ Stage 5) verification gate + handoff

**Files:** `docs/superpowers/HANDOFF.md` (rest verification only).

- [ ] **Step 1: Full green gate.** `npx tsc --noEmit && npm run lint && npm test && npm run build` → all PASS. Report test count (**139**) + route count (**27**).

- [ ] **Step 2: Realtime fully out of legacy — grep gates.**
```bash
grep -rn "@/entities\|@/features\|@/legacy" src/shared/realtime/realtime-provider.tsx   # EMPTY (pure shared, generic relay)
grep -rn "@/legacy" src/widgets/realtime-shell src/widgets/preview-canvas   # EMPTY (no widget→legacy realtime edge remains)
grep -rn "@/legacy/components/realtime\|legacy/components/realtime" src app tests   # EMPTY (dir deleted)
test ! -d src/legacy/components/realtime && echo "legacy realtime dir gone OK"
grep -rn "@/widgets/realtime-shell" "app/p/[publicId]/layout.tsx"   # layout repointed
```

- [ ] **Step 3: Realtime behavior intact (structural).** Confirm: the provider in `shared/realtime` still does presence sync + cursor broadcast (`self:false`, joined-guard, RAF) + chat/pin relay fan-out (with `!m?.id`/`!pin?.id` guards), payloads now `unknown`; `chat-panel` casts to `ChatMessageDTO` + `pin-layer` casts `PinEvent.pin` to `PinDTO`; the channel still mounts at the layout via `RealtimeShell`; the editor preview is still provider-less (`useRealtimeOptional` null-safe). The `RealtimeShell` still renders `children` + `PresenceBar` + `ChatPanel` and provides identity.

- [ ] **Step 4: Manual realtime E2E (if Supabase env) — full Stage-5 smoke.** Two browsers, public proposal: presence avatars appear; live cursors track; chat send/receive (5b); pin place/edit/resolve/delete sync (5c); reload persists chat + pins. Editor detail page (logged-in) still renders the preview with NO realtime errors (provider-less). If no env, rely on tsc/lint/test/build + note it.

- [ ] **Step 5: Update the handoff — Stage 5 COMPLETE.** Add a Stage 5d "Done" entry: `RealtimeProvider` → `shared/realtime/realtime-provider.tsx` (generic relay — `unknown` payloads, `PinEvent.pin: unknown`, NO `@/entities`/`@/legacy`; presence/cursors/identity session state); `widgets/realtime-shell` (RealtimeShell + chat-panel + presence-bar); `canvas-cursors`/`pin-layer` repointed to `@/shared/realtime/realtime-provider` (last widget→legacy edges gone); layout imports `@/widgets/realtime-shell`; `src/legacy/components/realtime/` deleted. Note that **Stage 5 (realtime) is fully complete** — pins/chat/cursors/presence all on the new architecture (data in React Query, session in `shared/realtime`), `src/legacy/lib/` empty + `src/legacy/components/{preview,realtime}` gone. State what remains in `src/legacy` for **Stage 6** (run `find src/legacy -type f` and list it — e.g. the `variant-tabs`/editor upload shells + any remaining components). Set next = **Stage 6 (cleanup + full permission audit + delete `src/legacy`)**. Commit:
```bash
npx prettier --write docs/superpowers/HANDOFF.md
git add docs/superpowers/HANDOFF.md
git commit -m "docs: handoff — Stage 5 complete (realtime fully migrated), next = Stage 6 cleanup"
```

---

## Self-Review (completed by author)

- **Spec coverage:** provider → shared/realtime (generic relay, no upward import); shell + segments → widgets/realtime-shell; last widget→legacy edges removed; layout repointed; legacy realtime dir deleted. Stage 5 done.
- **Layering:** the provider is pure `shared` (generic `unknown` relay — the key decision that avoids shared→entities). Consumers (widgets) own the domain casts. No widget→widget (provider in shared). Verified by the Task-5/6 greps.
- **Green-at-commit:** Task 1 moves the provider + repoints ALL importers (legacy shell/presence/chat via legacy→shared + the two widgets) in one commit; Task 2 moves the shell + repoints the layout + deletes the dir. Both compile.
- **Behavior preservation:** only payload TYPES (→ `unknown` + consumer casts) and file LOCATIONS change; channel/presence/cursor/relay logic + the `!m?.id`/`!pin?.id` guards + `self:false` + layout-level mount + the provider-less editor are all unchanged.
- **No placeholders:** the generic relay edits are spelled out; the moves are `git mv`; the casts are named per consumer.
- **Risk:** medium — it's the realtime core, but no logic change (typing + relocation only); tsc/lint/build catch wiring; the manual E2E (deferred where no env) is the realtime-correctness backstop. The generic-`unknown` relay is a minor type-safety relaxation at the transport boundary (the payloads are untrusted wire data anyway, guarded by `!*.id` + cast at consumers).

## Next: Stage 6 (cleanup)
Full permission audit (every read/mutation guarded), delete whatever remains in `src/legacy`, remove empty leftover dirs, final whole-branch review, and the deploy/merge decision (master has stayed untouched throughout). Plus the carry-forwards: non-transactional multi-step mutations; the bucket-public ops step per environment; runtime smoke across all migrated stages.
