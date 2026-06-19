# Refactor Stage 5a — Relocate the shared preview render tree → `widgets/preview-canvas`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move the entire shared preview render tree out of `src/legacy` into a NEW `src/widgets/preview-canvas` slice, with **zero behavior change**. This is substage **5a** of Stage 5 (realtime). It deliberately does NOT migrate any pin/chat DATA, does NOT promote the realtime provider, and does NOT touch the realtime/chat behavior — those are 5b/5c/5d. 5a only relocates the pure UI so the cross-page `@/legacy/components/preview` coupling (which both the viewer and the editor depend on) is cleared first.

**Architecture:** Both the viewer (`src/pages/public-viewer`) and the editor (`src/pages/proposal-detail`) render a shared preview tree (`ProposalPreview` → `CanvasView` → `{FullscreenSlides, PinLayer, CanvasCursors}`) plus side-specific compositions (`PublicViewer` with variant-list/compare/nav + `PinContext`; `ProposalEditorPreview` with version history). All of it moves into one cohesive `widgets/preview-canvas` slice that exports the two composition entry points (`PublicViewer`, `ProposalEditorPreview`). The two pages switch their import from `@/legacy/components/preview/*` to `@/widgets/preview-canvas` in the **same commit** (the shared-widget relocation is atomic even though the data migration is not).

**Why it's safe to move now (the decisive finding from the cluster map):** the editor preview is intentionally provider-less and pin/cursor/chat-free; it tolerates the absence of the realtime provider via three null-safe seams that 5a MUST preserve verbatim: `useRealtimeOptional()` returns `null` (never throws); `CanvasCursorLayer`/`CanvasCursorCapture` no-op when there's no provider; `usePins` guards every `rt?.…`. So moving the shared canvas changes nothing for either side — cursors/pins/chat keep working exactly as before.

**Tech Stack:** Next.js 16 (App Router), React 19, nuqs (URL state), `react-zoom-pan-pinch` (canvas), Tailwind, `@tanstack/react-query` v5 (only consumed by the pages, untouched here). No tests added (pure relocation; verify via tsc/lint/build + grep).

**Source:** cluster map + decomposition (Option B, user-approved 2026-06-19). Spec: `docs/superpowers/specs/2026-06-17-fsd-react-query-refactor-design.md`. Handoff: `docs/superpowers/HANDOFF.md`.

## Global Constraints

- **Node ≥22** (already active, v22.18.0 — do not switch).
- **FSD layer order:** `shared < entities < features < widgets < pages < app`. `src/widgets/preview-canvas` MAY import `@/entities`, `@/features`, `@/shared` (all lower). Pages import the widget.
- **Stage-5 transient exception (NEW, documented):** during Stage 5, `widgets/preview-canvas` MAY temporarily import `@/legacy` — these specific edges only, all removed by **5c/5d**:
  - `pin-layer.tsx` → `@/legacy/lib/pins/use-pins` (the pin hook; moves to `entities/pin` + `features/pin-comment` in **5c**).
  - `pin-layer.tsx` / `canvas-view.tsx` / `proposal-preview.tsx` / `public-viewer.tsx` → `@/legacy/lib/pins/types` (the `PinContext`/pin types; move to `entities/pin/model` in **5c**).
  - `canvas-cursors.tsx` → `@/legacy/components/realtime/realtime-provider` (`useRealtimeOptional`; the provider moves to `shared/realtime` in **5d**).
  - **No other** `@/legacy` import is allowed in the widget. **Pages must NOT gain any `@/legacy/lib` import** (the page exception is `@/legacy/components` only) — this is WHY the compositions live in the widget, not the pages.
- **Zero behavior change.** Every moved file's body is unchanged except import paths. The null-safe realtime seams (`useRealtimeOptional`, the `rt?.` guards, the cursor no-ops) are preserved verbatim. No component is rewritten. The editor stays provider-less; the viewer keeps its `PinContext` wiring.
- **Green at every commit.** Task 1 is one atomic relocation (move + repoint all internal imports + repoint both pages + delete emptied legacy) so the tree compiles at the single Task-1 commit. Verify `npx tsc --noEmit && npm run lint && npm run build`.
- **One commit per task.** Prettier-format touched/new files before committing. `format:check` stays globally red on remaining `src/legacy` + `app/`.

### Type fact (verified)

`src/legacy/lib/preview/types.ts` is a **pure re-export alias**: `export type { ProposalPage as PreviewPage } from "@/entities/proposal";` (nothing else). So every `import type { PreviewPage } from "@/legacy/lib/preview/types"` can be replaced with `import type { ProposalPage } from "@/entities/proposal"` (rename the local type usages `PreviewPage` → `ProposalPage`) and the alias file deleted. Shapes are identical.

### Target widget layout

```
src/widgets/preview-canvas/
  ui/
    proposal-preview.tsx        (shared core; renders FullscreenSlides | CanvasView per ?view)
    canvas-view.tsx             (zoom/pan canvas; renders PinLayer + CanvasCursor layers)
    fullscreen-slides.tsx
    pin-layer.tsx               (transient: legacy use-pins + legacy pins/types)
    canvas-cursors.tsx          (transient: legacy realtime-provider useRealtimeOptional)
    compare-view.tsx            (viewer-only)
    variant-list.tsx            (viewer-only)
    variant-viewer-nav.tsx      (viewer-only)
    public-viewer.tsx           (VIEWER composition; transient: legacy pins/types PinContext)
    proposal-editor-preview.tsx (EDITOR composition; imports @/features/{add-version,restore-version})
  lib/
    slide-nav.ts
    locate.ts
    use-prefetch-images.ts
  index.ts   → export { PublicViewer } from "./ui/public-viewer";
               export { ProposalEditorPreview } from "./ui/proposal-editor-preview";
```

### Import-repoint table (the full move — apply exactly)

Files moving from `src/legacy/components/preview/*` and `src/legacy/components/realtime/canvas-cursors.tsx` → `src/widgets/preview-canvas/ui/*`; `src/legacy/lib/preview/slide-nav.ts` + `src/legacy/lib/pins/locate.ts` + `src/legacy/components/preview/use-prefetch-images.ts` → `src/widgets/preview-canvas/lib/*`. After moving, fix imports:

| File (new location)                                     | Old import                                                                             | New import                                                                |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `ui/proposal-preview.tsx`                               | `./fullscreen-slides`, `./canvas-view`                                                 | unchanged (same dir)                                                      |
| `ui/proposal-preview.tsx`                               | `type { PreviewPage } from "@/legacy/lib/preview/types"`                               | `type { ProposalPage } from "@/entities/proposal"` (rename usages)        |
| `ui/proposal-preview.tsx`                               | `type { PinContext } from "@/legacy/lib/pins/types"`                                   | **keep** (transient, 5c)                                                  |
| `ui/canvas-view.tsx`                                    | `./pin-layer`, `./canvas-cursors` → was `@/legacy/components/realtime/canvas-cursors`  | `./canvas-cursors` (now same dir)                                         |
| `ui/canvas-view.tsx`                                    | `type { PreviewPage } …`                                                               | `type { ProposalPage } from "@/entities/proposal"`                        |
| `ui/canvas-view.tsx`                                    | `type { PinContext } from "@/legacy/lib/pins/types"`                                   | **keep** (transient, 5c)                                                  |
| `ui/fullscreen-slides.tsx`                              | `@/legacy/lib/preview/slide-nav`                                                       | `../lib/slide-nav`                                                        |
| `ui/fullscreen-slides.tsx`                              | `type { PreviewPage } …`                                                               | `type { ProposalPage } from "@/entities/proposal"`                        |
| `ui/pin-layer.tsx`                                      | `@/legacy/lib/pins/locate`                                                             | `../lib/locate`                                                           |
| `ui/pin-layer.tsx`                                      | `@/legacy/lib/pins/use-pins`                                                           | **keep** (transient, 5c)                                                  |
| `ui/pin-layer.tsx`                                      | `type { PinContext } from "@/legacy/lib/pins/types"`                                   | **keep** (transient, 5c)                                                  |
| `ui/pin-layer.tsx`                                      | `type { PreviewPage } …`                                                               | `type { ProposalPage } from "@/entities/proposal"`                        |
| `ui/canvas-cursors.tsx`                                 | `./realtime-provider`                                                                  | `@/legacy/components/realtime/realtime-provider` (**keep** transient, 5d) |
| `ui/compare-view.tsx`                                   | `type { PreviewPage } …`                                                               | `type { ProposalPage } from "@/entities/proposal"`                        |
| `ui/variant-list.tsx`                                   | `type { PreviewPage } …`                                                               | `type { ProposalPage } from "@/entities/proposal"`                        |
| `ui/public-viewer.tsx`                                  | `./proposal-preview`, `./compare-view`, `./variant-viewer-nav`, `./variant-list`       | unchanged (same dir)                                                      |
| `ui/public-viewer.tsx`                                  | `./use-prefetch-images`                                                                | `../lib/use-prefetch-images`                                              |
| `ui/public-viewer.tsx`                                  | `type { PinContext } from "@/legacy/lib/pins/types"`                                   | **keep** (transient, 5c)                                                  |
| `ui/proposal-editor-preview.tsx`                        | `./proposal-preview`                                                                   | unchanged (same dir)                                                      |
| `ui/proposal-editor-preview.tsx`                        | `./use-prefetch-images`                                                                | `../lib/use-prefetch-images`                                              |
| `src/pages/public-viewer/ui/public-viewer-page.tsx`     | `{ PublicViewer } from "@/legacy/components/preview/public-viewer"`                    | `{ PublicViewer } from "@/widgets/preview-canvas"`                        |
| `src/pages/proposal-detail/ui/proposal-detail-page.tsx` | `{ ProposalEditorPreview } from "@/legacy/components/preview/proposal-editor-preview"` | `{ ProposalEditorPreview } from "@/widgets/preview-canvas"`               |

(`canvas-cursors.tsx`/`pin-layer.tsx` keep `toContent` from `@/shared/realtime/coords` and `@/shared/ui/*` — already shared, unchanged. `proposal-editor-preview.tsx` keeps `@/features/{add-version,restore-version}` + `@/shared/ui/badge` + `@/entities/proposal` EditorVariant. `public-viewer.tsx` keeps `@/entities/proposal` ViewerVariant + nuqs.)

---

### Task 1: Atomic relocation of the preview tree → `widgets/preview-canvas`

**Files (move 13, repoint 2 pages, delete 1 alias + 2 emptied dirs):**

- Create dir: `src/widgets/preview-canvas/{ui,lib}/`
- Move → `ui/`: `proposal-preview.tsx`, `canvas-view.tsx`, `fullscreen-slides.tsx`, `compare-view.tsx`, `variant-list.tsx`, `variant-viewer-nav.tsx`, `pin-layer.tsx`, `public-viewer.tsx`, `proposal-editor-preview.tsx` (from `src/legacy/components/preview/`) + `canvas-cursors.tsx` (from `src/legacy/components/realtime/`)
- Move → `lib/`: `slide-nav.ts` (from `src/legacy/lib/preview/`), `locate.ts` (from `src/legacy/lib/pins/`), `use-prefetch-images.ts` (from `src/legacy/components/preview/`)
- Create: `src/widgets/preview-canvas/index.ts`
- Modify: `src/pages/public-viewer/ui/public-viewer-page.tsx`, `src/pages/proposal-detail/ui/proposal-detail-page.tsx` (repoint imports)
- Modify (test importers of the moved lib — repoint in the SAME commit): `tests/preview/slide-nav.test.ts`, `tests/pins/locate.test.ts`
- Delete: `src/legacy/lib/preview/types.ts` (the `PreviewPage` alias, after repointing all `PreviewPage` usages)
- Delete (empty after move): `src/legacy/components/preview/`, `src/legacy/lib/preview/`

- [ ] **Step 1: Pre-flight — find the COMPLETE importer set (incl. `tests/`).** No consumer of the moving files may be missed. Scope every grep to `src app tests` (the `tests/` tree IS in the tsc program — `tsconfig.json include: **/*.ts` — and in vitest, so a missed test importer breaks the green gate just like a src one).

```bash
grep -rln "components/preview/\|realtime/canvas-cursors" src app tests | grep -v "^src/legacy/components/preview/" | grep -v "^src/legacy/components/realtime/canvas-cursors"
# Expect ONLY: src/pages/public-viewer/ui/public-viewer-page.tsx, src/pages/proposal-detail/ui/proposal-detail-page.tsx
grep -rln "@/legacy/lib/preview/slide-nav\|@/legacy/lib/pins/locate\|components/preview/use-prefetch-images" src app tests | grep -v "^src/legacy/"
# Expect: tests/preview/slide-nav.test.ts + tests/pins/locate.test.ts (the two test importers of the moved lib — repointed in Step 3). Anything ELSE (e.g. variant-tabs.tsx, a loading.tsx) → STOP and report; it must be repointed too.
```

- [ ] **Step 2: Create the widget dirs + `git mv` every file.**

```bash
mkdir -p src/widgets/preview-canvas/ui src/widgets/preview-canvas/lib
git mv src/legacy/components/preview/proposal-preview.tsx        src/widgets/preview-canvas/ui/
git mv src/legacy/components/preview/canvas-view.tsx             src/widgets/preview-canvas/ui/
git mv src/legacy/components/preview/fullscreen-slides.tsx       src/widgets/preview-canvas/ui/
git mv src/legacy/components/preview/compare-view.tsx            src/widgets/preview-canvas/ui/
git mv src/legacy/components/preview/variant-list.tsx            src/widgets/preview-canvas/ui/
git mv src/legacy/components/preview/variant-viewer-nav.tsx      src/widgets/preview-canvas/ui/
git mv src/legacy/components/preview/pin-layer.tsx               src/widgets/preview-canvas/ui/
git mv src/legacy/components/preview/public-viewer.tsx           src/widgets/preview-canvas/ui/
git mv src/legacy/components/preview/proposal-editor-preview.tsx src/widgets/preview-canvas/ui/
git mv src/legacy/components/realtime/canvas-cursors.tsx         src/widgets/preview-canvas/ui/
git mv src/legacy/components/preview/use-prefetch-images.ts     src/widgets/preview-canvas/lib/
git mv src/legacy/lib/preview/slide-nav.ts                       src/widgets/preview-canvas/lib/
git mv src/legacy/lib/pins/locate.ts                             src/widgets/preview-canvas/lib/
```

- [ ] **Step 3: Repoint imports inside the moved files** per the Import-repoint table above. Specifically:
  - In `ui/proposal-preview.tsx`, `ui/canvas-view.tsx`, `ui/fullscreen-slides.tsx`, `ui/pin-layer.tsx`, `ui/compare-view.tsx`, `ui/variant-list.tsx`: replace `import type { PreviewPage } from "@/legacy/lib/preview/types"` with `import type { ProposalPage } from "@/entities/proposal"` and rename the local `PreviewPage` usages to `ProposalPage`.
  - `ui/fullscreen-slides.tsx`: `@/legacy/lib/preview/slide-nav` → `../lib/slide-nav`.
  - `ui/pin-layer.tsx`: `@/legacy/lib/pins/locate` → `../lib/locate`. **Keep** `@/legacy/lib/pins/use-pins` and `@/legacy/lib/pins/types` (transient).
  - `ui/canvas-view.tsx`: the `CanvasCursor*` import `@/legacy/components/realtime/canvas-cursors` → `./canvas-cursors`. **Keep** `@/legacy/lib/pins/types` (transient).
  - `ui/canvas-cursors.tsx`: `./realtime-provider` → `@/legacy/components/realtime/realtime-provider` (**keep** as a legacy edge — transient, 5d).
  - `ui/public-viewer.tsx`: `./use-prefetch-images` → `../lib/use-prefetch-images`. **Keep** `@/legacy/lib/pins/types` (transient).
  - `ui/proposal-editor-preview.tsx`: `./use-prefetch-images` → `../lib/use-prefetch-images`.
  - **The two test importers (same atomic commit):** `tests/preview/slide-nav.test.ts`: `@/legacy/lib/preview/slide-nav` → `@/widgets/preview-canvas/lib/slide-nav`; `tests/pins/locate.test.ts`: `@/legacy/lib/pins/locate` → `@/widgets/preview-canvas/lib/locate`. (Bodies unchanged — only the import specifier; the tests now exercise the moved widget-lib functions.)
  - All other relative `./x` imports between files now co-located in `ui/` stay as `./x`.

- [ ] **Step 4: Create the widget barrel** `src/widgets/preview-canvas/index.ts`:

```ts
export { PublicViewer } from "./ui/public-viewer";
export { ProposalEditorPreview } from "./ui/proposal-editor-preview";
```

- [ ] **Step 5: Repoint the two pages.**
  - `src/pages/public-viewer/ui/public-viewer-page.tsx`: `import { PublicViewer } from "@/legacy/components/preview/public-viewer";` → `import { PublicViewer } from "@/widgets/preview-canvas";`
  - `src/pages/proposal-detail/ui/proposal-detail-page.tsx`: `import { ProposalEditorPreview } from "@/legacy/components/preview/proposal-editor-preview";` → `import { ProposalEditorPreview } from "@/widgets/preview-canvas";`

- [ ] **Step 6: Delete the now-unused `PreviewPage` alias + confirm empty legacy dirs.**

```bash
grep -rn "legacy/lib/preview/types\|PreviewPage" src app tests   # expect NO output (all repointed to ProposalPage)
git rm src/legacy/lib/preview/types.ts
# these dirs should now be empty — remove them if so:
ls -A src/legacy/components/preview src/legacy/lib/preview 2>/dev/null   # expect empty / no such file
rmdir src/legacy/components/preview src/legacy/lib/preview 2>/dev/null || true
```

- [ ] **Step 7: Verify green + the transient-edge invariant.**

```bash
npx tsc --noEmit && npm run lint && npm run build   # all PASS; build route count unchanged (27)
# The widget's ONLY legacy edges are the three documented transients:
grep -rn "@/legacy" src/widgets/preview-canvas
# Expect ONLY: pin-layer use-pins + (pin-layer/canvas-view/proposal-preview/public-viewer) lib/pins/types + canvas-cursors realtime-provider. NOTHING else.
# Pages must NOT have gained a legacy/lib edge:
grep -rn "@/legacy/lib" src/pages/public-viewer src/pages/proposal-detail   # expect NO output
grep -rn "@/legacy/components/preview\|@/legacy/lib/preview\|@/legacy/lib/pins/locate" src app tests   # expect NO output (all moved + tests repointed)
```

- [ ] **Step 8: Format + commit.**

```bash
npx prettier --write src/widgets/preview-canvas "src/pages/public-viewer/ui/public-viewer-page.tsx" "src/pages/proposal-detail/ui/proposal-detail-page.tsx" tests/preview/slide-nav.test.ts tests/pins/locate.test.ts
git add -A
git commit -m "refactor: relocate shared preview tree to widgets/preview-canvas (Stage 5a)"
```

---

### Task 2: Stage 5a verification gate + handoff

**Files:** `docs/superpowers/HANDOFF.md` (rest is verification only).

- [ ] **Step 1: Full green gate** — Node ≥22: `npx tsc --noEmit && npm run lint && npm test && npm run build` → all PASS. Report the test count (expect **128** unchanged — no tests added/removed; the two relocated tests `slide-nav.test.ts`/`locate.test.ts` only had their import specifier repointed) and the build route count (expect **27** unchanged — no routes added).

- [ ] **Step 2: Relocation correctness greps.**

```bash
grep -rn "@/legacy/components/preview\|@/legacy/lib/preview\|@/legacy/lib/pins/locate" src app tests   # expect NO output (gone; tests repointed)
grep -rn "@/widgets/preview-canvas" src/pages/public-viewer src/pages/proposal-detail tests   # both pages + the two relocated tests repointed
grep -rn "@/legacy" src/widgets/preview-canvas   # ONLY the 3 documented transients (use-pins, lib/pins/types, realtime-provider)
grep -rn "@/legacy/lib" src/pages   # expect NO output (no legacy/lib edge leaked into pages)
test ! -d src/legacy/components/preview && test ! -d src/legacy/lib/preview && echo "legacy preview dirs gone OK"
```

- [ ] **Step 3: Behavior-preservation spot check (structural).** Confirm the null-safe realtime seams survived the move unchanged:

```bash
grep -n "useRealtimeOptional" src/widgets/preview-canvas/ui/canvas-cursors.tsx   # present (the no-throw hook)
grep -n "rt?\." src/legacy/lib/pins/use-pins.ts   # still guards every rt?. (provider-optional) — unchanged, still legacy
```

Confirm the editor path is still provider-less (the editor page does not mount a RealtimeProvider) and the viewer still builds `PinContext` in `public-viewer.tsx`.

- [ ] **Step 4: Update the handoff.** In `docs/superpowers/HANDOFF.md`: update the architecture diagram to add a `widgets/` layer (`widgets/preview-canvas` = the shared preview render tree + the viewer/editor compositions). Add a Stage 5a "Done" entry: the preview tree relocated out of `src/legacy/components/preview` (+ `canvas-cursors` from `components/realtime`, `slide-nav` from `lib/preview`, `locate` from `lib/pins`) into `widgets/preview-canvas`; `PreviewPage` alias deleted (use `ProposalPage`); both pages import `@/widgets/preview-canvas`; **documented transient widget→legacy edges remain** (pin-layer→`lib/pins/use-pins`, `lib/pins/types` PinContext on 4 files, canvas-cursors→`realtime-provider`) to be removed in 5c/5d; realtime/chat behavior unchanged (editor still provider-less, viewer pins/cursors/chat still work). Tests **128**, build **27 routes**. Set next = **Stage 5b (chat data)** — including the prep step to move `resolveViewerGate` → `shared/access` (user-approved) so the new pin/chat entity reads can import the gate without an entity→entity edge. Commit:

```bash
npx prettier --write docs/superpowers/HANDOFF.md
git add docs/superpowers/HANDOFF.md
git commit -m "docs: handoff — Stage 5a done (preview tree to widgets/preview-canvas), next = 5b chat"
```

---

## Self-Review (completed by author)

- **Scope:** 5a is a pure relocation — no data migration, no provider promotion, no behavior change. Pin/chat/cursors/presence stay exactly as they are (still legacy provider + use-pins); only the UI's physical home changes. Matches the user-approved Option B substage 5a.
- **Green-at-commit:** Task 1 is one atomic move (all internal imports + both pages repointed + legacy deleted in the same commit). No legacy→widget edge is ever introduced (the compositions move WITH the shared tree, so the still-legacy files never import the widget).
- **Transient edges are explicit + bounded:** the only `@/legacy` imports in the widget are the three documented ones (use-pins, lib/pins/types, realtime-provider), each with a named removal stage (5c/5c/5d). The page layer gains NO `@/legacy/lib` edge (the reason compositions live in the widget, not the pages).
- **Type safety:** `PreviewPage` is a verified pure alias of `ProposalPage` → repoint + delete is shape-safe.
- **No placeholders:** every move command + import edit is concrete; the repoint table is exhaustive.
- **Realtime safety:** the null-safe seams (`useRealtimeOptional`, cursor no-ops, `usePins` `rt?.` guards) are preserved verbatim — the editor stays provider-less and cannot crash; the viewer keeps its PinContext.
- **Risk:** low (mechanical relocation; tsc/lint/build catch any missed import). The only judgment call is the one-widget design (compositions + shared tree together) chosen to avoid both widget→widget same-layer edges AND a legacy/lib edge in the page layer.

**Adversarial audit (4 lenses, blocker/high refute-verified):** one real defect fixed (flagged by 3 lenses) — two unit tests import the moved libs by their old legacy paths (`tests/preview/slide-nav.test.ts` → `lib/preview/slide-nav`, `tests/pins/locate.test.ts` → `lib/pins/locate`) and the plan's greps only scanned `src app`; since `tsconfig.json include` is repo-wide (`**/*.ts`) and vitest runs `tests/**`, the move would have broken `tsc --noEmit` + `npm test` at the atomic Task-1 commit. Fixed: Task 1 Step 3 now repoints both test imports to `@/widgets/preview-canvas/lib/{slide-nav,locate}` in the same commit; every pre-flight/verification grep is scoped `src app tests`; both tests added to the Files list + Step 8 prettier set; the "128 unchanged" note clarified (import-only repoint, no test added/removed).

## Next: Stage 5b (chat data)

`entities/chat-message` (model + Zod from `validateChatBody`/`MAX_CHAT_BODY`, `get-recent-chat.server.ts`, `getRecentChat` fetcher, `chatQueries.list(publicId)`), ADD thin gate-mirrored `GET /api/p/[publicId]/chat`, rewrite the POST chat route thin via `features/send-chat-message` (`useMutation`). Move `resolveViewerGate` → `shared/access` first (prep). The realtime-shell bridges broadcast `chat` events → `setQueryData` (dedup by id); the layout stops threading `initialChat`; the provider stops owning `chatMessages`.
