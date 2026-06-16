# Phase 5 Stage 1 — 실시간 기반(참여자 + 커서) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 뷰어 `/p/[publicId]`를 감싸는 항상-보이는 껍데기(RealtimeShell)에 참여자 표시(presence)와 실시간 커서를 올린다 — 안 목록 화면부터 보이고 안/비교 전환에도 채널이 끊기지 않는다.

**Architecture:** Supabase Realtime 공개 채널 `proposal:<publicId>` 1개(Presence + Broadcast, 테이블 미접근). RealtimeShell을 `app/p/[publicId]/layout.tsx`에 두어 searchParam 내비게이션(`?v=`/`?compare=`)에도 마운트 유지. 게이트(`decideAccess`)는 layout·page가 공유 헬퍼로 판정하고, allow일 때만 셸을 마운트. 신원은 자동 익명(이름+색, localStorage)이며 사용자가 변경 가능.

**Tech Stack:** Next.js 16 App Router(layout 지속성) · React 19 · `@supabase/ssr` 브라우저 클라이언트 + `@supabase/supabase-js` Realtime(Presence/Broadcast) · nuqs(기존) · Vitest.

**Spec:** `docs/superpowers/specs/2026-06-16-phase5-realtime-meeting-design.md` (Stage 1 범위). Stage 2(채팅·핀 저장)는 별도 plan.

**Branch:** `feat/phase5-realtime` (이미 생성, 스펙 커밋됨). 커밋마다 `npx tsc --noEmit` + `npm test` 게이트. 2탭 브라우저 검증은 Stage 끝 수동.

---

## File Structure

**신규 생성**
- `lib/realtime/channel.ts` — 채널명 헬퍼(순수)
- `lib/realtime/coords.ts` — 좌표 정규화/클램프(순수)
- `lib/realtime/identity.ts` — 이름/색 생성·검증(순수) + localStorage 로드/저장(thin)
- `lib/access/viewer-gate.ts` — 서버 공유 게이트 헬퍼(proposal + decideAccess + editorName)
- `components/realtime/realtime-provider.tsx` — 채널 lifecycle + context(use client)
- `components/realtime/presence-bar.tsx` — 참여자 바 + 내 이름 변경
- `components/realtime/cursor-overlay.tsx` — 커서 송수신/렌더
- `components/realtime/realtime-shell.tsx` — 껍데기 조립(provider+bar+overlay+children)
- `app/p/[publicId]/layout.tsx` — allow일 때 children을 셸로 감쌈
- `tests/realtime/channel.test.ts` · `tests/realtime/coords.test.ts` · `tests/realtime/identity.test.ts`

**수정**
- `app/p/[publicId]/page.tsx` — 게이트 판정을 `resolveViewerGate`로 교체(중복 제거)
- `components/preview/variant-viewer-nav.tsx` — `<a>` → next/link `<Link>`(클라 내비 유지)
- `components/preview/variant-list.tsx` — 카드 `<a>` → `<Link>`

---

## Task 1: 채널명 헬퍼 (TDD)

**Files:**
- Create: `lib/realtime/channel.ts`
- Test: `tests/realtime/channel.test.ts`

- [ ] **Step 1: 실패 테스트**

`tests/realtime/channel.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { channelName } from "@/lib/realtime/channel";

describe("channelName", () => {
  it("prefixes the public id with 'proposal:'", () => {
    expect(channelName("AbC123de")).toBe("proposal:AbC123de");
  });
  it("is stable for the same id", () => {
    expect(channelName("x")).toBe(channelName("x"));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/realtime/channel.test.ts`
Expected: FAIL — `Cannot find module '@/lib/realtime/channel'`

- [ ] **Step 3: 구현**

`lib/realtime/channel.ts`:
```ts
// One public Supabase Realtime room per proposal, keyed by its public id.
export function channelName(publicId: string): string {
  return `proposal:${publicId}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/realtime/channel.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/realtime/channel.ts tests/realtime/channel.test.ts
git commit -m "feat: realtime channel name helper (Phase 5 S1)"
```

---

## Task 2: 좌표 정규화 (TDD)

**Files:**
- Create: `lib/realtime/coords.ts`
- Test: `tests/realtime/coords.test.ts`

- [ ] **Step 1: 실패 테스트**

`tests/realtime/coords.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { clamp01, toNorm, fromNorm } from "@/lib/realtime/coords";

describe("clamp01", () => {
  it("clamps below 0 and above 1", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.3)).toBe(0.3);
  });
});

describe("toNorm", () => {
  it("maps a pixel within [start, start+size] to 0..1", () => {
    expect(toNorm(50, 0, 100)).toBe(0.5);
    expect(toNorm(100, 100, 200)).toBe(0); // at start
    expect(toNorm(300, 100, 200)).toBe(1); // at end
  });
  it("clamps out-of-range pixels", () => {
    expect(toNorm(-10, 0, 100)).toBe(0);
    expect(toNorm(150, 0, 100)).toBe(1);
  });
  it("returns 0 when size is non-positive", () => {
    expect(toNorm(50, 0, 0)).toBe(0);
  });
});

describe("fromNorm", () => {
  it("is the inverse of toNorm within range", () => {
    expect(fromNorm(0.5, 0, 100)).toBe(50);
    expect(fromNorm(toNorm(120, 100, 200), 100, 200)).toBe(120);
  });
  it("clamps the normalized input", () => {
    expect(fromNorm(2, 0, 100)).toBe(100);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/realtime/coords.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: 구현**

`lib/realtime/coords.ts`:
```ts
export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// Pixel within [start, start+size] → normalized 0..1 (clamped). size<=0 → 0.
export function toNorm(px: number, start: number, size: number): number {
  if (size <= 0) return 0;
  return clamp01((px - start) / size);
}

// Normalized 0..1 (clamped) → pixel within [start, start+size].
export function fromNorm(n: number, start: number, size: number): number {
  return start + clamp01(n) * size;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/realtime/coords.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/realtime/coords.ts tests/realtime/coords.test.ts
git commit -m "feat: realtime coord normalization helpers (Phase 5 S1)"
```

---

## Task 3: 신원(이름/색) 헬퍼 (TDD 순수부 + localStorage thin)

**Files:**
- Create: `lib/realtime/identity.ts`
- Test: `tests/realtime/identity.test.ts`

- [ ] **Step 1: 실패 테스트**

`tests/realtime/identity.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { IDENTITY_COLORS, pickColor, defaultGuestName, parseIdentity } from "@/lib/realtime/identity";

describe("pickColor", () => {
  it("returns a palette color", () => {
    for (let i = 0; i < 20; i++) expect(IDENTITY_COLORS).toContain(pickColor(i));
  });
  it("is deterministic for the same seed", () => {
    expect(pickColor(7)).toBe(pickColor(7));
  });
});

describe("defaultGuestName", () => {
  it("formats as 'Guest NNNN'", () => {
    expect(defaultGuestName(0)).toMatch(/^Guest \d{4}$/);
  });
});

describe("parseIdentity", () => {
  it("accepts a well-formed identity", () => {
    const v = parseIdentity(JSON.stringify({ id: "a", name: "Bob", color: "#ef4444" }));
    expect(v).toEqual({ id: "a", name: "Bob", color: "#ef4444" });
  });
  it("rejects malformed JSON or missing fields", () => {
    expect(parseIdentity("not json")).toBeNull();
    expect(parseIdentity(JSON.stringify({ id: "a" }))).toBeNull();
    expect(parseIdentity(JSON.stringify({ id: "a", name: "", color: "#fff" }))).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/realtime/identity.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: 구현**

`lib/realtime/identity.ts`:
```ts
export type Identity = { id: string; name: string; color: string };

export const IDENTITY_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
] as const;

export function pickColor(seed: number): string {
  return IDENTITY_COLORS[Math.abs(Math.trunc(seed)) % IDENTITY_COLORS.length];
}

export function defaultGuestName(seed: number): string {
  return `Guest ${(Math.abs(Math.trunc(seed)) % 9000) + 1000}`;
}

export function parseIdentity(raw: string | null): Identity | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (o && typeof o.id === "string" && o.id &&
        typeof o.name === "string" && o.name &&
        typeof o.color === "string" && o.color) {
      return { id: o.id, name: o.name, color: o.color };
    }
  } catch {
    // fall through
  }
  return null;
}

const STORAGE_KEY = "uxis:identity";

// Browser-only: load the saved identity or create a fresh anonymous one.
// `editorName`, when present (logged-in editor), overrides only the display name.
export function loadOrCreateIdentity(editorName: string | null): Identity {
  const existing = typeof localStorage !== "undefined" ? parseIdentity(localStorage.getItem(STORAGE_KEY)) : null;
  let identity = existing;
  if (!identity) {
    const seed = Math.floor(Math.random() * 1_000_000);
    const id = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : String(seed);
    identity = { id, name: defaultGuestName(seed), color: pickColor(seed) };
  }
  if (editorName) identity = { ...identity, name: editorName };
  saveIdentity(identity);
  return identity;
}

export function saveIdentity(identity: Identity): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/realtime/identity.test.ts`
Expected: PASS. (`loadOrCreateIdentity`/`saveIdentity`는 브라우저 전용 — 단위 테스트 대상 아님.)

- [ ] **Step 5: 커밋**

```bash
git add lib/realtime/identity.ts tests/realtime/identity.test.ts
git commit -m "feat: realtime guest identity helpers (Phase 5 S1)"
```

---

## Task 4: RealtimeProvider (채널 lifecycle + context)

**Files:**
- Create: `components/realtime/realtime-provider.tsx`

게이트: `npx tsc --noEmit 2>&1 | grep "components/realtime/realtime-provider.tsx"` → empty.

- [ ] **Step 1: 작성**

`components/realtime/realtime-provider.tsx`:
```tsx
"use client";
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { channelName } from "@/lib/realtime/channel";
import type { Identity } from "@/lib/realtime/identity";

export type Participant = { id: string; name: string; color: string };
export type RemoteCursor = { id: string; name: string; color: string; xNorm: number; yNorm: number };

type RealtimeContextValue = {
  participants: Participant[];
  cursors: RemoteCursor[];
  sendCursor: (xNorm: number, yNorm: number) => void;
  clearCursor: () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}

export function RealtimeProvider({ publicId, identity, children }: {
  publicId: string; identity: Identity; children: React.ReactNode;
}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const identityRef = useRef<Identity>(identity);
  identityRef.current = identity;

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);

  // (Re)create the channel only when the room or my stable id changes.
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const ch = supabase.channel(channelName(publicId), {
      config: { presence: { key: identity.id }, broadcast: { self: false } },
    });
    channelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ name: string; color: string }>();
      setParticipants(
        Object.entries(state).map(([id, metas]) => ({
          id,
          name: metas[0]?.name ?? "Guest",
          color: metas[0]?.color ?? "#888888",
        })),
      );
    });

    ch.on("broadcast", { event: "cursor" }, ({ payload }) => {
      const p = payload as RemoteCursor;
      setCursors((prev) => [...prev.filter((c) => c.id !== p.id), p]);
    });
    ch.on("broadcast", { event: "cursor_leave" }, ({ payload }) => {
      const id = (payload as { id: string }).id;
      setCursors((prev) => prev.filter((c) => c.id !== id));
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ name: identityRef.current.name, color: identityRef.current.color });
      }
    });

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [publicId, identity.id]);

  // Re-broadcast presence when the display name/color changes (e.g. rename).
  useEffect(() => {
    channelRef.current?.track({ name: identity.name, color: identity.color }).catch(() => {});
  }, [identity.name, identity.color]);

  const sendCursor = useCallback((xNorm: number, yNorm: number) => {
    const me = identityRef.current;
    channelRef.current?.send({
      type: "broadcast", event: "cursor",
      payload: { id: me.id, name: me.name, color: me.color, xNorm, yNorm },
    });
  }, []);

  const clearCursor = useCallback(() => {
    channelRef.current?.send({ type: "broadcast", event: "cursor_leave", payload: { id: identityRef.current.id } });
  }, []);

  return (
    <RealtimeContext.Provider value={{ participants, cursors, sendCursor, clearCursor }}>
      {children}
    </RealtimeContext.Provider>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit 2>&1 | grep "components/realtime/realtime-provider.tsx"` (empty)
```bash
git add components/realtime/realtime-provider.tsx
git commit -m "feat: RealtimeProvider — channel presence + cursor broadcast (Phase 5 S1)"
```

---

## Task 5: PresenceBar (참여자 + 내 이름 변경)

**Files:**
- Create: `components/realtime/presence-bar.tsx`

게이트: `npx tsc --noEmit 2>&1 | grep "components/realtime/presence-bar.tsx"` → empty.

- [ ] **Step 1: 작성**

`components/realtime/presence-bar.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRealtime } from "./realtime-provider";
import type { Identity } from "@/lib/realtime/identity";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PresenceBar({ identity, onRename }: {
  identity: Identity; onRename: (name: string) => void;
}) {
  const { participants } = useRealtime();
  const [editing, setEditing] = useState(false);

  // Show others first, then me (presence includes my own key).
  const others = participants.filter((p) => p.id !== identity.id);

  return (
    <div className="fixed right-3 top-3 z-50 flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 shadow-sm backdrop-blur">
      <div className="flex -space-x-1.5">
        {others.slice(0, 6).map((p) => (
          <span key={p.id} title={p.name}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-background text-[10px] font-medium text-white"
            style={{ backgroundColor: p.color }}>
            {p.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
        {others.length === 0 && <span className="text-xs text-muted-foreground">혼자 보는 중</span>}
        {others.length > 6 && <span className="text-xs text-muted-foreground">+{others.length - 6}</span>}
      </div>
      <span className="mx-1 h-4 w-px bg-border" />
      {editing ? (
        <form onSubmit={(e) => {
          e.preventDefault();
          const name = (e.currentTarget.elements.namedItem("name") as HTMLInputElement).value.trim();
          if (name) onRename(name);
          setEditing(false);
        }} className="flex items-center gap-1">
          <Input name="name" defaultValue={identity.name} autoFocus className="h-7 w-28" />
          <Button size="sm" type="submit" className="h-7">저장</Button>
        </form>
      ) : (
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: identity.color }} />
          <span className="font-medium">{identity.name}</span>
          <span className="text-muted-foreground">(나)</span>
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit 2>&1 | grep "components/realtime/presence-bar.tsx"` (empty)
```bash
git add components/realtime/presence-bar.tsx
git commit -m "feat: presence bar with inline rename (Phase 5 S1)"
```

---

## Task 6: CursorOverlay (커서 송수신/렌더)

**Files:**
- Create: `components/realtime/cursor-overlay.tsx`

게이트: `npx tsc --noEmit 2>&1 | grep "components/realtime/cursor-overlay.tsx"` → empty.

- [ ] **Step 1: 작성**

뷰포트 정규화(`clientX/innerWidth`)로 좌표를 broadcast하고, 수신 커서를 퍼센트 위치로 렌더한다. pointermove는 `requestAnimationFrame`으로 1프레임당 1회로 제한.

`components/realtime/cursor-overlay.tsx`:
```tsx
"use client";
import { useEffect, useRef } from "react";
import { useRealtime } from "./realtime-provider";

export function CursorOverlay() {
  const { cursors, sendCursor, clearCursor } = useRealtime();
  const frame = useRef<number | null>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      pending.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
      if (frame.current == null) {
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          if (pending.current) sendCursor(pending.current.x, pending.current.y);
        });
      }
    }
    function onLeave() { clearCursor(); }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("blur", onLeave);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("pointerleave", onLeave);
      if (frame.current != null) cancelAnimationFrame(frame.current);
      clearCursor();
    };
  }, [sendCursor, clearCursor]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {cursors.map((c) => (
        <div key={c.id} className="absolute -translate-y-1 translate-x-0 transition-[left,top] duration-75 ease-linear"
          style={{ left: `${c.xNorm * 100}%`, top: `${c.yNorm * 100}%` }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ color: c.color }}>
            <path d="M1 1l5 14 2-5 5-2L1 1z" fill="currentColor" stroke="white" strokeWidth="1" />
          </svg>
          <span className="ml-3 rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: c.color }}>
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit 2>&1 | grep "components/realtime/cursor-overlay.tsx"` (empty)
```bash
git add components/realtime/cursor-overlay.tsx
git commit -m "feat: live cursor overlay (viewport-normalized) (Phase 5 S1)"
```

---

## Task 7: RealtimeShell (껍데기 조립)

**Files:**
- Create: `components/realtime/realtime-shell.tsx`

게이트: `npx tsc --noEmit 2>&1 | grep "components/realtime/realtime-shell.tsx"` → empty.

- [ ] **Step 1: 작성**

신원 상태는 셸이 소유한다. localStorage 접근은 브라우저에서만 가능하므로 `useEffect`로 로드(첫 렌더는 셸 없이 children만 → 하이드레이션 불일치 방지).

`components/realtime/realtime-shell.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { RealtimeProvider } from "./realtime-provider";
import { PresenceBar } from "./presence-bar";
import { CursorOverlay } from "./cursor-overlay";
import { type Identity, loadOrCreateIdentity, saveIdentity } from "@/lib/realtime/identity";

export function RealtimeShell({ publicId, editorName, children }: {
  publicId: string; editorName: string | null; children: React.ReactNode;
}) {
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    setIdentity(loadOrCreateIdentity(editorName));
  }, [editorName]);

  if (!identity) return <>{children}</>;

  function rename(name: string) {
    setIdentity((prev) => {
      if (!prev) return prev;
      const next = { ...prev, name };
      saveIdentity(next);
      return next;
    });
  }

  return (
    <RealtimeProvider publicId={publicId} identity={identity}>
      {children}
      <PresenceBar identity={identity} onRename={rename} />
      <CursorOverlay />
    </RealtimeProvider>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit 2>&1 | grep "components/realtime/realtime-shell.tsx"` (empty)
```bash
git add components/realtime/realtime-shell.tsx
git commit -m "feat: RealtimeShell assembling provider + presence + cursors (Phase 5 S1)"
```

---

## Task 8: 공유 게이트 헬퍼 + page.tsx 정리

**Files:**
- Create: `lib/access/viewer-gate.ts`
- Modify: `app/p/[publicId]/page.tsx`

- [ ] **Step 1: 게이트 헬퍼 작성**

`lib/access/viewer-gate.ts`:
```ts
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, type Proposal } from "@/drizzle/schema";
import { getProfile } from "@/lib/auth/session";
import { isEditor, type Role } from "@/lib/auth/roles";
import { decideAccess, type AccessDecision } from "@/lib/proposals/access";
import { verifyUnlockToken, unlockCookieName } from "@/lib/access/cookie";

export type ViewerGate = {
  proposal: Proposal | null;
  decision: AccessDecision;
  editorName: string | null;
};

// Single source of truth for public-viewer access, shared by the layout (to gate the
// realtime shell) and the page (to gate content). One light proposal fetch per call.
export async function resolveViewerGate(publicId: string): Promise<ViewerGate> {
  const rows = await db.select().from(proposals).where(eq(proposals.publicId, publicId)).limit(1);
  const proposal = rows[0] ?? null;
  if (!proposal) return { proposal: null, decision: "forbidden", editorName: null };

  const profile = await getProfile();
  const editor = isEditor(profile?.role as Role | undefined);

  const cookieStore = await cookies();
  const token = cookieStore.get(unlockCookieName(publicId))?.value ?? "";
  const nowSec = Math.floor(Date.now() / 1000);
  const hasValidUnlock = !!token &&
    verifyUnlockToken(token, publicId, nowSec, process.env.ACCESS_TOKEN_SECRET!);

  const decision = decideAccess({
    visibility: proposal.visibility,
    hasPassword: !!proposal.accessPasswordHash,
    isEditor: editor,
    hasValidUnlock,
  });

  return { proposal, decision, editorName: editor ? (profile?.displayName ?? null) : null };
}
```

- [ ] **Step 2: page.tsx의 인라인 게이트를 헬퍼로 교체**

`app/p/[publicId]/page.tsx`에서 import 정리 — 다음 import들을 제거:
```ts
import { cookies } from "next/headers";
import { getProfile } from "@/lib/auth/session";
import { isEditor, type Role } from "@/lib/auth/roles";
import { decideAccess } from "@/lib/proposals/access";
import { verifyUnlockToken, unlockCookieName } from "@/lib/access/cookie";
```
그리고 추가:
```ts
import { resolveViewerGate } from "@/lib/access/viewer-gate";
```
함수 본문에서 `const rows = await db.select()...proposal = rows[0]; if(!proposal) notFound();` 부터 `const decision = decideAccess({...});` 까지의 게이트 블록 전체를 다음으로 교체:
```ts
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) notFound();
```
(이후 `decision === "forbidden"` / `"need-password"` / allow 분기와 `proposal.title` 등 사용은 그대로. `proposals` import는 여전히 다른 쿼리에서 쓰이면 유지, 안 쓰면 제거 — `proposalVariants`·`proposalPages`는 계속 사용하므로 유지.)

- [ ] **Step 3: 검증 + 커밋**

Run: `npx tsc --noEmit` (전체 clean) · `npm test` (37+ pass)
Expected: 0 errors, 모든 테스트 통과. page 동작 동일(게이트 결과 불변).
```bash
git add lib/access/viewer-gate.ts app/p/[publicId]/page.tsx
git commit -m "refactor: shared resolveViewerGate for public viewer (Phase 5 S1)"
```

---

## Task 9: layout.tsx — allow일 때 셸로 감싸기

**Files:**
- Create: `app/p/[publicId]/layout.tsx`

- [ ] **Step 1: 작성**

`app/p/[publicId]/layout.tsx`:
```tsx
import { resolveViewerGate } from "@/lib/access/viewer-gate";
import { RealtimeShell } from "@/components/realtime/realtime-shell";

// The layout persists across in-viewer navigations (?v=, ?compare=) on the same
// [publicId] segment, so the realtime channel mounted here is NOT torn down when
// switching variants. Mount the shell only after the access gate allows viewing.
export default async function PublicViewerLayout({
  params,
  children,
}: {
  params: Promise<{ publicId: string }>;
  children: React.ReactNode;
}) {
  const { publicId } = await params;
  const { decision, editorName } = await resolveViewerGate(publicId);

  if (decision !== "allow") return <>{children}</>;

  return (
    <RealtimeShell publicId={publicId} editorName={editorName}>
      {children}
    </RealtimeShell>
  );
}
```

- [ ] **Step 2: 검증 + 커밋**

Run: `npx tsc --noEmit` (clean) · `npm test` (pass)
```bash
git add app/p/[publicId]/layout.tsx
git commit -m "feat: public viewer layout mounts RealtimeShell when allowed (Phase 5 S1)"
```

---

## Task 10: 뷰어 내비를 next/link로 (채널 유지)

**Files:**
- Modify: `components/preview/variant-viewer-nav.tsx`
- Modify: `components/preview/variant-list.tsx`

레이아웃(셸)이 searchParam 내비게이션에도 유지되려면 클라이언트 내비여야 한다 → `<a href>`를 `next/link`의 `<Link href>`로 교체.

- [ ] **Step 1: `variant-viewer-nav.tsx` 교체**

전체를 다음으로:
```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type NavItem = { slug: string; label: string };

export function VariantViewerNav({ publicId, items, activeSlug }: {
  publicId: string; items: NavItem[]; activeSlug: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border p-2">
      <Link href={`/p/${publicId}`} className="text-sm underline">목록</Link>
      <span className="text-muted-foreground">·</span>
      {items.map((it) => (
        <Link key={it.slug} href={`/p/${publicId}?v=${it.slug}`}>
          <Badge variant={it.slug === activeSlug ? "default" : "outline"}>{it.label}</Badge>
        </Link>
      ))}
      <span className="text-muted-foreground">·</span>
      <Link href={`/p/${publicId}?compare=1`} className="text-sm underline">나란히 보기</Link>
    </div>
  );
}
```

- [ ] **Step 2: `variant-list.tsx` 카드 링크 교체**

`import type { PreviewPage } ...` 아래에 `import Link from "next/link";` 추가하고, 카드의 `<a key=... href={`/p/${publicId}?v=${it.slug}`} className="group block ...">...</a>` 를 동일 props의 `<Link ...>...</Link>`로 교체(여는 태그 `<a`→`<Link`, 닫는 `</a>`→`</Link>`, className/href 동일).

- [ ] **Step 3: 검증 + 커밋**

Run: `npx tsc --noEmit` (clean) · `npm run lint` (clean)
```bash
git add components/preview/variant-viewer-nav.tsx components/preview/variant-list.tsx
git commit -m "feat: client-side nav so realtime channel persists across variants (Phase 5 S1)"
```

---

## Task 11: 통합 검증 + 2탭 수동 체크 (사용자 핸드오프)

**Files:** (없음 — 검증)

- [ ] **Step 1: 정적 게이트**

```bash
rm -rf .next && npx tsc --noEmit && npm test && npm run lint
```
Expected: tsc 0 에러, 테스트 전부 통과(신규 realtime 3개 포함), lint clean.

- [ ] **Step 2: 2탭 수동 검증** (`npm run dev`, 같은 공개 시안 `/p/{publicId}`를 두 탭/창에서 열기 — 최소 1개는 공개 시안이어야 게이트 통과)

- [ ] 두 탭 모두 우상단 참여자 바에 상대 아바타가 보인다(안 목록 화면부터)
- [ ] 한 탭에서 마우스를 움직이면 다른 탭에 커서+이름이 실시간으로 보인다
- [ ] `?v=`/`?compare=`로 이동해도 참여자/커서가 끊기지 않는다(채널 유지)
- [ ] 이름 변경 시 다른 탭의 참여자 바/커서 라벨이 갱신된다
- [ ] 한 탭을 닫으면 다른 탭의 참여자에서 사라진다
- [ ] 비공개 시안(편집자 아님)·비번 미입력 시안에서는 셸이 뜨지 않는다(게이트)

> 문제 시 superpowers:systematic-debugging → 해당 태스크 수정 → 재커밋. (Realtime이 Supabase 프로젝트에서 활성인지, publishable 키 env가 있는지 먼저 확인.)

- [ ] **Step 3: 사용자 보고 + 머지 결정**

자동 게이트 결과를 보고하고, 2탭 검증은 사용자가 직접 수행하도록 핸드오프. 사용자가 확인 후 `master` ff-merge 진행. (Stage 2 — 채팅·핀 저장 — 는 별도 plan으로 이어서 작성.)

---

## Self-Review (작성자 확인 완료)

- **Spec 커버리지(Stage 1)**: presence 바 안목록부터 상존(Task 7·9·5), 커서 항상-보임 오버레이(Task 6), 채널 1개·안 전환 유지(Task 9 layout + Task 10 Link), 자동 익명 신원+변경+localStorage(Task 3·5·7), 공개 뷰어 전용·게이트 통과 후 mount(Task 8·9), 순수 헬퍼 테스트(Task 1·2·3). Stage 2(채팅·핀·테이블·BFF)는 의도적으로 이 plan 제외.
- **Placeholder 스캔**: 없음. 모든 코드 블록 실제 내용.
- **타입 일관성**: `Identity{id,name,color}`·`Participant`·`RemoteCursor` 전 태스크 일치, `useRealtime()` 컨텍스트 시그니처(`participants/cursors/sendCursor/clearCursor`) 일치, `resolveViewerGate` 반환형(`proposal/decision/editorName`)을 layout·page가 동일 사용, 채널 이벤트명(`cursor`/`cursor_leave`) 송수신 일치.
