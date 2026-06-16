# Phase 2 — Preview UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Before coding:** this repo runs **Next.js 16** + React 19 + Tailwind v4 + `@base-ui/react` (NOT Radix — the `Button` has no `asChild`; use `onClick`/`render`). The running app requires **Node ≥22**; `npm test`/`tsc`/`build`/`lint` work on Node 20. Verify with those headless checks — browser interaction (click-advance, pan/zoom) is deferred to a later E2E phase on Node 22.

**Goal:** Replace the Phase 1b "minimal vertical render" viewer with a shared `<ProposalPreview>` that toggles between a 1920-fixed fullscreen slide view and a Figma-style pan/zoom canvas, used by both the public viewer and the editor detail page.

**Architecture:** One client component `ProposalPreview` (container-filling) renders a top toggle and switches between `FullscreenSlides` (one page at a time, native 1920px width, hidden scrollbar) and `CanvasView` (react-zoom-pan-pinch over a horizontal row of pages). Pages arrive as props (`{id, url, width, height}`) — signed read URLs minted server-side (BFF preserved). Navigation index logic is a pure, unit-tested helper.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, `react-zoom-pan-pinch` (pan/zoom), Vitest. Spec: `docs/superpowers/specs/2026-06-16-phase2-preview-ux-design.md`.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `package.json` (modify) | add `react-zoom-pan-pinch` |
| `lib/preview/types.ts` (create) | `PreviewPage` type (shared, pure) |
| `lib/preview/slide-nav.ts` (create) | pure index clamp/next/prev |
| `tests/preview/slide-nav.test.ts` (create) | unit tests |
| `app/globals.css` (modify) | `.no-scrollbar` utility |
| `components/preview/fullscreen-slides.tsx` (create) | one-page slide view |
| `components/preview/canvas-view.tsx` (create) | pan/zoom canvas |
| `components/preview/proposal-preview.tsx` (create) | toggle + view switch |
| `app/p/[publicId]/page.tsx` (modify) | use `ProposalPreview` (full viewport) |
| `app/(dashboard)/dashboard/proposals/[id]/page.tsx` (modify) | use `ProposalPreview` (boxed) |

---

## Task 1: Install react-zoom-pan-pinch

**Files:**
- Modify: `package.json` (+ lockfile)

- [ ] **Step 1: Install the library**

Run:
```bash
npm install react-zoom-pan-pinch
```

- [ ] **Step 2: Verify it imports and typechecks**

Run:
```bash
node -e "console.log(require('react-zoom-pan-pinch/package.json').version)"
```
Expected: prints a version (3.x).

If `npm install` errors on a React 19 peer-dependency conflict, retry with `npm install react-zoom-pan-pinch --legacy-peer-deps` and note it. If the package cannot install or import at all, STOP and report BLOCKED (the canvas view depends on it).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-zoom-pan-pinch"
```

---

## Task 2: Pure slide-navigation helper + shared type (TDD)

**Files:**
- Create: `lib/preview/types.ts`, `lib/preview/slide-nav.ts`
- Test: `tests/preview/slide-nav.test.ts`

- [ ] **Step 1: Create the shared type `lib/preview/types.ts`**

```ts
// A single rendered page: signed read URL + native pixel dimensions.
export type PreviewPage = { id: string; url: string; width: number; height: number };
```

- [ ] **Step 2: Write the failing test `tests/preview/slide-nav.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { clampIndex, nextIndex, prevIndex } from "@/lib/preview/slide-nav";

describe("slide navigation", () => {
  it("clamps within [0, count-1]", () => {
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(99, 5)).toBe(4);
    expect(clampIndex(2, 5)).toBe(2);
  });
  it("returns 0 for an empty list", () => {
    expect(clampIndex(0, 0)).toBe(0);
  });
  it("advances but stops at the last page", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(2);
  });
  it("retreats but stops at the first page", () => {
    expect(prevIndex(2, 3)).toBe(1);
    expect(prevIndex(0, 3)).toBe(0);
  });
});
```

- [ ] **Step 3: Run it, verify failure**

Run: `npm test -- slide-nav`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `lib/preview/slide-nav.ts`**

```ts
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (index < 0) return 0;
  if (index > count - 1) return count - 1;
  return index;
}

export function nextIndex(index: number, count: number): number {
  return clampIndex(index + 1, count);
}

export function prevIndex(index: number, count: number): number {
  return clampIndex(index - 1, count);
}
```

- [ ] **Step 5: Run it, verify pass**

Run: `npm test -- slide-nav`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/preview/types.ts lib/preview/slide-nav.ts tests/preview/slide-nav.test.ts
git commit -m "feat: add preview page type + slide-nav helper"
```

---

## Task 3: Hidden-scrollbar utility + fullscreen slide view

**Files:**
- Modify: `app/globals.css`
- Create: `components/preview/fullscreen-slides.tsx`

- [ ] **Step 1: Add a `.no-scrollbar` utility to `app/globals.css`**

Append to the end of `app/globals.css`:
```css

/* Hide scrollbar but keep scrollability — so a vertical scrollbar never eats
   horizontal space and shrinks the native-1920 slide image. */
.no-scrollbar {
  scrollbar-width: none; /* Firefox */
}
.no-scrollbar::-webkit-scrollbar {
  display: none; /* WebKit */
}
```

- [ ] **Step 2: Create `components/preview/fullscreen-slides.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import type { PreviewPage } from "@/lib/preview/types";
import { nextIndex, prevIndex } from "@/lib/preview/slide-nav";

export function FullscreenSlides({ pages }: { pages: PreviewPage[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setIndex((i) => nextIndex(i, pages.length));
      else if (e.key === "ArrowLeft") setIndex((i) => prevIndex(i, pages.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages.length]);

  if (pages.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground">페이지가 없습니다.</div>;
  }

  const page = pages[index];
  return (
    <div className="relative h-full w-full bg-background">
      {/* key={page.id} remounts on change → scroll resets to top.
          overflow-y scroll (hidden scrollbar) for tall pages; overflow-x clipped
          (narrow screens crop the right edge — never scale down). Click = next. */}
      <div
        key={page.id}
        className="no-scrollbar h-full w-full overflow-x-hidden overflow-y-auto"
        onClick={() => setIndex((i) => nextIndex(i, pages.length))}
      >
        {/* max-w-none keeps the image at its native (1920px) width — no scaling */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={page.url} alt="" width={page.width} height={page.height} className="block max-w-none select-none" draggable={false} />
      </div>
      <div className="pointer-events-none absolute right-3 bottom-3 rounded bg-foreground/80 px-2 py-1 text-xs text-background">
        {index + 1}/{pages.length}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/preview/fullscreen-slides.tsx
git commit -m "feat: add fullscreen slide view (native 1920, hidden scrollbar)"
```

---

## Task 4: Canvas (pan/zoom) view

**Files:**
- Create: `components/preview/canvas-view.tsx`

- [ ] **Step 1: Create `components/preview/canvas-view.tsx`**

```tsx
"use client";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { PreviewPage } from "@/lib/preview/types";

export function CanvasView({ pages }: { pages: PreviewPage[] }) {
  if (pages.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground">페이지가 없습니다.</div>;
  }
  return (
    <div className="h-full w-full bg-muted">
      <TransformWrapper minScale={0.1} maxScale={4} centerOnInit limitToBounds={false}>
        {/* Use inline-style props (not `!important` classes) to reliably override
            the library's own inline wrapper/content styles. */}
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ display: "flex", alignItems: "flex-start", gap: "2rem", padding: "2rem" }}
        >
          {pages.map((pg) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={pg.id}
              src={pg.url}
              alt=""
              width={pg.width}
              height={pg.height}
              draggable={false}
              className="block max-w-none select-none border border-border bg-background"
            />
          ))}
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `react-zoom-pan-pinch` exports differ in the installed version, confirm `TransformWrapper`/`TransformComponent` are the named exports via `node -e "console.log(Object.keys(require('react-zoom-pan-pinch')))"` and adjust imports accordingly — report any deviation.)

- [ ] **Step 3: Commit**

```bash
git add components/preview/canvas-view.tsx
git commit -m "feat: add canvas pan/zoom view"
```

---

## Task 5: ProposalPreview (toggle + view switch)

**Files:**
- Create: `components/preview/proposal-preview.tsx`

- [ ] **Step 1: Create `components/preview/proposal-preview.tsx`**

```tsx
"use client";
import { useState } from "react";
import type { PreviewPage } from "@/lib/preview/types";
import { FullscreenSlides } from "./fullscreen-slides";
import { CanvasView } from "./canvas-view";
import { Button } from "@/components/ui/button";

export function ProposalPreview({ pages }: { pages: PreviewPage[] }) {
  const [view, setView] = useState<"fullscreen" | "canvas">("fullscreen");
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
        <Button size="sm" variant={view === "fullscreen" ? "default" : "outline"} onClick={() => setView("fullscreen")}>풀화면</Button>
        <Button size="sm" variant={view === "canvas" ? "default" : "outline"} onClick={() => setView("canvas")}>캔버스</Button>
      </div>
      <div className="min-h-0 flex-1">
        {view === "fullscreen" ? <FullscreenSlides pages={pages} /> : <CanvasView pages={pages} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/preview/proposal-preview.tsx
git commit -m "feat: add ProposalPreview toggle wrapper"
```

---

## Task 6: Integrate into the public viewer

**Files:**
- Modify: `app/p/[publicId]/page.tsx`

- [ ] **Step 1: Add the import**

At the top of `app/p/[publicId]/page.tsx`, add to the imports:
```tsx
import { ProposalPreview } from "@/components/preview/proposal-preview";
```

- [ ] **Step 2: Include width/height in the previews mapping and render the preview**

Replace this block:
```tsx
  // decision === "allow"
  const pages = proposal.currentVersionId
    ? await db.select().from(proposalPages)
        .where(eq(proposalPages.versionId, proposal.currentVersionId)).orderBy(asc(proposalPages.pageOrder))
    : [];
  const previews = await Promise.all(pages.map(async (pg) => ({ id: pg.id, url: await createReadUrl(pg.storagePath) })));

  return (
    <div className="mx-auto max-w-[1920px]">
      {previews.length === 0 && <p className="p-8 text-sm text-muted-foreground">아직 페이지가 없습니다.</p>}
      {previews.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p.id} src={p.url} alt="" className="block w-full" />
      ))}
    </div>
  );
}
```
with:
```tsx
  // decision === "allow"
  const pages = proposal.currentVersionId
    ? await db.select().from(proposalPages)
        .where(eq(proposalPages.versionId, proposal.currentVersionId)).orderBy(asc(proposalPages.pageOrder))
    : [];
  const previews = await Promise.all(
    pages.map(async (pg) => ({
      id: pg.id,
      url: await createReadUrl(pg.storagePath),
      width: pg.width,
      height: pg.height,
    })),
  );

  return (
    <div className="h-screen w-screen">
      <ProposalPreview pages={previews} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/p/[publicId]/page.tsx"
git commit -m "feat: use ProposalPreview in public viewer"
```

---

## Task 7: Integrate into the editor detail page

**Files:**
- Modify: `app/(dashboard)/dashboard/proposals/[id]/page.tsx`

- [ ] **Step 1: Add the import**

At the top of `app/(dashboard)/dashboard/proposals/[id]/page.tsx`, add to the imports:
```tsx
import { ProposalPreview } from "@/components/preview/proposal-preview";
```

- [ ] **Step 2: Include width/height in the previews mapping**

Replace:
```tsx
  const previews = await Promise.all(currentPages.map(async (pg) => ({ id: pg.id, url: await createReadUrl(pg.storagePath) })));
```
with:
```tsx
  const previews = await Promise.all(
    currentPages.map(async (pg) => ({
      id: pg.id,
      url: await createReadUrl(pg.storagePath),
      width: pg.width,
      height: pg.height,
    })),
  );
```

- [ ] **Step 3: Replace the preview section with the boxed `ProposalPreview`**

Replace:
```tsx
      <section className="space-y-3">
        <h2 className="text-lg font-medium">현재 버전 미리보기</h2>
        {previews.length === 0 && <p className="text-sm text-muted-foreground">페이지가 없습니다.</p>}
        <div className="space-y-4">
          {previews.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt="" className="max-w-full border border-border" />
          ))}
        </div>
      </section>
```
with:
```tsx
      <section className="space-y-3">
        <h2 className="text-lg font-medium">현재 버전 미리보기</h2>
        <div className="h-[80vh] overflow-hidden rounded-[8px] border border-border">
          <ProposalPreview pages={previews} />
        </div>
      </section>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/proposals/[id]/page.tsx"
git commit -m "feat: use ProposalPreview in editor detail page"
```

---

## Task 8: Finalize — build, test, lint

**Files:**
- (No new files; verification.)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all suites pass (existing 28 + slide-nav).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds, no type errors. `/p/[publicId]` and `/dashboard/proposals/[id]` still listed.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual E2E (deferred — requires Node ≥22 + browser + an editor account)**

On `nvm use 22 && npm run dev`, as an editor with a proposal that has multi-page images:
- Open `/dashboard/proposals/<id>` → preview box shows toggle; 풀화면 shows page 1 with `1/N` indicator; clicking advances; ←/→ navigate; a tall page scrolls vertically with no visible scrollbar and the image is not shrunk.
- Switch to 캔버스 → all pages laid out in a row; drag pans; wheel zooms.
- Open `/p/<publicId>` (public proposal) in incognito → same preview fills the viewport.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: Phase 2 finalize (build + tests green)"
```

---

## Done criteria (Phase 2)

- Public viewer and editor detail both render the shared `<ProposalPreview>` with a 풀화면/캔버스 toggle (default 풀화면).
- Fullscreen: one page at a time, click + ←/→ navigation, `N/total` indicator, image at native 1920px (never scaled down), tall pages scroll vertically with a hidden scrollbar.
- Canvas: all pages in a horizontal row, drag-to-pan + wheel-to-zoom via react-zoom-pan-pinch.
- `slide-nav` unit tests pass; build/typecheck/lint green.

**Next plan:** Phase 3 — Realtime collaboration (cursor presence, chat broadcast + history, pin comments) layered on the canvas view.
