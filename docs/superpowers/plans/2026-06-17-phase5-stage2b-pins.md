# Phase 5 Stage 2b — 핀 코멘트(캔버스·로그인) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 뷰어의 단일 안 **캔버스 뷰**에서 로그인 사용자가 특정 페이지 지점에 핀 코멘트를 남기고(본인만 수정·삭제, 로그인 누구나 resolved), 실시간으로 반영한다.

**Architecture:** 핀은 안의 **현재 버전 스냅샷**(variant+version+page_order+x/y_norm)에 고정. 좌표는 기존 캔버스 커서 인프라(콘텐츠 좌표 `toContent` + `--inv-scale`)를 재사용해, 마커·팝오버·작성기를 모두 transform 레이어 **내부**에 렌더한다. 쓰기는 BFF(`/api/p/[publicId]/pins`)로만 — `resolveViewerGate` 뷰 게이트 + 세션·소유권 검증. 실시간은 `RealtimeProvider`가 `pin`/`pin_updated`/`pin_deleted` broadcast를 pub/sub로 중계한다.

**Tech Stack:** Next.js(App Router) · Drizzle(postgres-js) · Supabase(Auth/Realtime) · react-zoom-pan-pinch · Vitest · Tailwind/shadcn.

**상위 스펙:** `docs/superpowers/specs/2026-06-17-phase5-stage2b-pins-design.md`

---

## 작업 브랜치

Stage 2a(`feat/phase5-chat`)가 아직 master에 머지 전이므로, **그 위에서** 작업한다(채팅의 마이그 0005·BFF 네임스페이스·쿠키 수정 위에 핀이 얹힘). master 머지가 끝났다면 master 기준으로 분기.

```bash
git switch feat/phase5-chat && git switch -c feat/phase5-pins
```

태스크별 작은 커밋, 커밋마다 `npx tsc --noEmit`(+해당 시 Vitest). 좌표·로그인·실시간은 Task 14에서 2탭 수동 검증.

## File Structure

```
lib/pins/locate.ts                         locatePin/placePin (순수·TDD)
lib/access/safe-redirect.ts                isSafeInternalPath (순수·TDD)
lib/pins/types.ts                          PinDTO · PinEvent · PinContext
lib/pins/load-pins.ts                      loadPinsForVersion (server)
lib/pins/use-pins.ts                       usePins 훅 (GET + 구독 + CRUD + broadcast)
drizzle/schema.ts                          pin_comments + 타입 (modify)
drizzle/migrations/0006_*.sql              테이블 + FK + RLS + index
scripts/check-proposals.mts                RLS 목록에 pin_comments (modify)
lib/access/viewer-gate.ts                  resolveViewerGate에 viewer 추가 (modify)
app/(auth)/login/page.tsx · actions.ts     returnTo 지원 (modify)
app/api/p/[publicId]/pins/route.ts         GET·POST (BFF)
app/api/p/[publicId]/pins/[pinId]/route.ts PATCH·DELETE (BFF)
components/realtime/realtime-provider.tsx  myColor + pin pub/sub + broadcast (modify)
lib/preview/types.ts                       PreviewPage에 pageOrder (modify)
lib/preview/load-variants.ts               pageOrder 포함 (modify)
app/p/[publicId]/page.tsx                  PublicViewer에 publicId·viewer 전달 (modify)
components/preview/public-viewer.tsx       활성 변형 → pinContext (modify)
components/preview/proposal-preview.tsx    pin prop 통과 (modify)
components/preview/canvas-view.tsx         모드 토글 + data-page-index + PinLayer (modify)
components/preview/pin-layer.tsx           핀 마커·팝오버·작성기 (신규)
```

---

## Task 1: 핀 좌표 순수 함수 `lib/pins/locate.ts` (TDD)

**Files:** Create `lib/pins/locate.ts` · Test `tests/pins/locate.test.ts`

- [ ] **Step 1: 실패 테스트 `tests/pins/locate.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { locatePin, placePin } from "@/lib/pins/locate";

const boxes = [
  { left: 0, top: 0, width: 100, height: 200, pageOrder: 0 },
  { left: 150, top: 0, width: 100, height: 200, pageOrder: 1 },
];

describe("locatePin", () => {
  it("locates a point inside a page and normalizes within it", () => {
    expect(locatePin(50, 100, boxes)).toEqual({ pageOrder: 0, xNorm: 0.5, yNorm: 0.5 });
    expect(locatePin(200, 50, boxes)).toEqual({ pageOrder: 1, xNorm: 0.5, yNorm: 0.25 });
  });
  it("returns null in the gap/padding between pages", () => {
    expect(locatePin(125, 100, boxes)).toBeNull();
  });
  it("returns null outside all pages", () => {
    expect(locatePin(-10, 100, boxes)).toBeNull();
    expect(locatePin(50, 999, boxes)).toBeNull();
  });
  it("clamps norms on the exact edge", () => {
    expect(locatePin(100, 200, boxes)).toEqual({ pageOrder: 0, xNorm: 1, yNorm: 1 });
  });
  it("ignores degenerate (zero-size) boxes", () => {
    expect(locatePin(0, 0, [{ left: 0, top: 0, width: 0, height: 0, pageOrder: 9 }])).toBeNull();
  });
});

describe("placePin", () => {
  it("maps a normalized point back to content coords within the box", () => {
    expect(placePin(boxes[0], 0.5, 0.5)).toEqual({ x: 50, y: 100 });
    expect(placePin(boxes[1], 0, 1)).toEqual({ x: 150, y: 200 });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run `npx vitest run tests/pins/locate.test.ts` → FAIL(모듈 없음).

- [ ] **Step 3: 구현 `lib/pins/locate.ts`**
```ts
import { clamp01 } from "@/lib/realtime/coords";

export type PageBox = { left: number; top: number; width: number; height: number; pageOrder: number };
export type PinLocation = { pageOrder: number; xNorm: number; yNorm: number };

// 콘텐츠 좌표 (cx,cy)가 어떤 페이지 박스 안이면 그 페이지 기준 정규화 좌표를, 아니면 null.
export function locatePin(cx: number, cy: number, boxes: PageBox[]): PinLocation | null {
  for (const b of boxes) {
    if (b.width <= 0 || b.height <= 0) continue;
    if (cx >= b.left && cx <= b.left + b.width && cy >= b.top && cy <= b.top + b.height) {
      return {
        pageOrder: b.pageOrder,
        xNorm: clamp01((cx - b.left) / b.width),
        yNorm: clamp01((cy - b.top) / b.height),
      };
    }
  }
  return null;
}

// 정규화 좌표 → 박스 내 콘텐츠 좌표(placePin은 locatePin의 역).
export function placePin(box: PageBox, xNorm: number, yNorm: number): { x: number; y: number } {
  return { x: box.left + clamp01(xNorm) * box.width, y: box.top + clamp01(yNorm) * box.height };
}
```

- [ ] **Step 4: 통과 확인** — Run `npx vitest run tests/pins/locate.test.ts` → PASS.
- [ ] **Step 5: 커밋**
```bash
git add lib/pins/locate.ts tests/pins/locate.test.ts
git commit -m "feat: pin content-coordinate locate/place helpers (Phase 5 Stage 2b)"
```

---

## Task 2: returnTo 안전 검증 `lib/access/safe-redirect.ts` (TDD)

**Files:** Create `lib/access/safe-redirect.ts` · Test `tests/access/safe-redirect.test.ts`

- [ ] **Step 1: 실패 테스트 `tests/access/safe-redirect.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { isSafeInternalPath } from "@/lib/access/safe-redirect";

describe("isSafeInternalPath", () => {
  it("accepts internal absolute paths", () => {
    expect(isSafeInternalPath("/p/abc")).toBe(true);
    expect(isSafeInternalPath("/p/abc?v=a")).toBe(true);
    expect(isSafeInternalPath("/dashboard")).toBe(true);
  });
  it("rejects non-strings / empty", () => {
    expect(isSafeInternalPath(null)).toBe(false);
    expect(isSafeInternalPath(undefined)).toBe(false);
    expect(isSafeInternalPath("")).toBe(false);
  });
  it("rejects protocol-relative and backslash tricks (open redirect)", () => {
    expect(isSafeInternalPath("//evil.com")).toBe(false);
    expect(isSafeInternalPath("/\\evil.com")).toBe(false);
    expect(isSafeInternalPath("https://evil.com")).toBe(false);
  });
  it("rejects paths not starting with /", () => {
    expect(isSafeInternalPath("p/abc")).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run `npx vitest run tests/access/safe-redirect.test.ts` → FAIL.

- [ ] **Step 3: 구현 `lib/access/safe-redirect.ts`**
```ts
// 오픈 리다이렉트 방지: 내부 절대 경로(`/`로 시작)만 허용하고,
// 프로토콜-상대(`//`)·역슬래시(`/\`) 트릭은 거부.
export function isSafeInternalPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0) return false;
  if (path[0] !== "/") return false;
  if (path[1] === "/" || path[1] === "\\") return false;
  return true;
}
```

- [ ] **Step 4: 통과 확인** — Run `npx vitest run tests/access/safe-redirect.test.ts` → PASS.
- [ ] **Step 5: 커밋**
```bash
git add lib/access/safe-redirect.ts tests/access/safe-redirect.test.ts
git commit -m "feat: safe internal-path guard for returnTo (Phase 5 Stage 2b)"
```

---

## Task 3: 스키마 + 마이그레이션 `pin_comments`

**Files:** Modify `drizzle/schema.ts` · Create `drizzle/migrations/0006_*.sql` · Modify `scripts/check-proposals.mts:3`

> ⚠️ 공유 라이브 DB 변경. `db:generate`는 DB 미접속(안전), **`db:migrate`는 적용 직전 컨트롤러가 사용자 확인 후 실행**(0005 때와 동일). 구현 에이전트는 generate·본문교체·커밋까지만, `db:migrate`는 실행하지 말 것.

- [ ] **Step 1: `drizzle/schema.ts` 끝에 `pin_comments` + 타입 추가**

(`index`는 이미 import됨. 끝에 추가:)
```ts
export const pinComments = pgTable("pin_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull(),     // FK via SQL
  variantId: uuid("variant_id").notNull(),       // FK via SQL
  versionId: uuid("version_id").notNull(),        // FK via SQL
  pageOrder: integer("page_order").notNull(),
  xNorm: real("x_norm").notNull(),
  yNorm: real("y_norm").notNull(),
  authorId: uuid("author_id"),                    // FK via SQL (set null), 소유권 기준
  authorName: text("author_name").notNull(),
  authorColor: text("author_color").notNull(),
  body: text("body").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("pin_comments_variant_version_page_idx").on(t.variantId, t.versionId, t.pageOrder),
]);

export type PinComment = typeof pinComments.$inferSelect;
```

- [ ] **Step 2: import에 `real`·`boolean` 추가**

1번째 줄을 다음으로 교체:
```ts
import { pgTable, uuid, text, timestamp, integer, unique, check, index, real, boolean } from "drizzle-orm/pg-core";
```

- [ ] **Step 3: 생성** — Run `npm run db:generate` → `drizzle/migrations/0006_<random>.sql` + snapshot/journal 갱신. (생성 SQL엔 FK/RLS 없음 → 다음 스텝 교체.)

- [ ] **Step 4: 생성된 `0006_*.sql` 본문을 아래로 전체 교체**
```sql
CREATE TABLE "pin_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"page_order" integer NOT NULL,
	"x_norm" real NOT NULL,
	"y_norm" real NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"author_color" text NOT NULL,
	"body" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pin_comments" ADD CONSTRAINT "pin_comments_proposal_id_proposals_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "pin_comments" ADD CONSTRAINT "pin_comments_variant_id_variants_fk" FOREIGN KEY ("variant_id") REFERENCES "proposal_variants"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "pin_comments" ADD CONSTRAINT "pin_comments_version_id_versions_fk" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "pin_comments" ADD CONSTRAINT "pin_comments_author_id_profiles_fk" FOREIGN KEY ("author_id") REFERENCES "profiles"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "pin_comments_variant_version_page_idx" ON "pin_comments" ("variant_id","version_id","page_order");
--> statement-breakpoint
ALTER TABLE "pin_comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pin_comments" FORCE ROW LEVEL SECURITY;
```

- [ ] **Step 5: `scripts/check-proposals.mts` RLS 목록에 추가** — 3번째 줄을:
```ts
for (const rel of ["proposals", "proposal_variants", "proposal_versions", "proposal_pages", "chat_messages", "pin_comments"]) {
```

- [ ] **Step 6: 타입체크(적용 없이)** — Run `npx tsc --noEmit` → 통과. **`db:migrate`는 실행하지 말 것.** 2차 `npm run db:generate`가 "No schema changes" 보고하는지로 스냅샷 일관성 확인.

- [ ] **Step 7: 커밋**
```bash
git add drizzle/schema.ts drizzle/migrations scripts/check-proposals.mts
git commit -m "feat: pin_comments table + RLS deny backstop (Phase 5 Stage 2b)"
```

---

## Task 4: PinDTO 타입 + 서버 로더

**Files:** Create `lib/pins/types.ts` · Create `lib/pins/load-pins.ts`

- [ ] **Step 1: `lib/pins/types.ts`**
```ts
// 핀의 클라이언트/전송 표현(createdAt ISO 문자열 — RSC·broadcast·상태 동일 모양).
export type PinDTO = {
  id: string;
  variantId: string;
  versionId: string;
  pageOrder: number;
  xNorm: number;
  yNorm: number;
  authorId: string | null;
  authorName: string;
  authorColor: string;
  body: string;
  resolved: boolean;
  createdAt: string; // ISO 8601
};

// provider→PinLayer로 중계되는 실시간 이벤트.
export type PinEvent =
  | { type: "pin"; pin: PinDTO }
  | { type: "pin_updated"; pin: PinDTO }
  | { type: "pin_deleted"; id: string };

// 캔버스로 내려보내는 핀 기능 컨텍스트. viewerId=null이면 게스트(로그인 유도).
export type PinContext = {
  publicId: string;
  variantId: string;
  versionId: string;
  viewerId: string | null;
};
```

- [ ] **Step 2: `lib/pins/load-pins.ts`**
```ts
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pinComments } from "@/drizzle/schema";
import type { PinDTO } from "@/lib/pins/types";

// 한 안의 한 버전 핀 전체를 오래된→최신 순으로 DTO 반환.
export async function loadPinsForVersion(variantId: string, versionId: string): Promise<PinDTO[]> {
  const rows = await db
    .select()
    .from(pinComments)
    .where(and(eq(pinComments.variantId, variantId), eq(pinComments.versionId, versionId)))
    .orderBy(asc(pinComments.createdAt));
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

- [ ] **Step 3: 타입체크** — Run `npx tsc --noEmit` → 통과.
- [ ] **Step 4: 커밋**
```bash
git add lib/pins/types.ts lib/pins/load-pins.ts
git commit -m "feat: pin DTO + version loader (Phase 5 Stage 2b)"
```

---

## Task 5: 게이트 확장 — `resolveViewerGate`에 `viewer` 추가

**Files:** Modify `lib/access/viewer-gate.ts`

로그인한 뷰어(role 무관)의 `{ id, displayName }`을 추가 반환해, 페이지가 로그인 여부·작성자 일치 판정에 쓰게 한다.

- [ ] **Step 1: `ViewerGate` 타입에 `viewer` 추가**

`export type ViewerGate = { ... }`를 다음으로 교체:
```ts
export type ViewerGate = {
  proposal: Proposal | null;
  decision: AccessDecision;
  editorName: string | null;
  viewer: { id: string; displayName: string | null } | null;
};
```

- [ ] **Step 2: 본문에서 `viewer` 산출 + 반환**

`if (!proposal) return ...` 줄을 다음으로 교체:
```ts
  if (!proposal) return { proposal: null, decision: "forbidden", editorName: null, viewer: null };
```

마지막 `return { proposal, decision, editorName: ... };` 줄을 다음으로 교체:
```ts
  const viewer = profile ? { id: profile.id, displayName: profile.displayName } : null;
  return { proposal, decision, editorName: editor ? (profile?.displayName ?? null) : null, viewer };
```
(`profile`은 위에서 이미 `getProfile()`로 구해져 있다 — 추가 쿼리 없음.)

- [ ] **Step 3: 타입체크** — Run `npx tsc --noEmit` → 통과(기존 호출부는 구조분해라 영향 없음).
- [ ] **Step 4: 커밋**
```bash
git add lib/access/viewer-gate.ts
git commit -m "feat: resolveViewerGate returns logged-in viewer id/name (Phase 5 Stage 2b)"
```

---

## Task 6: 로그인 `returnTo` 지원

**Files:** Modify `app/(auth)/login/page.tsx` · Modify `app/(auth)/actions.ts`

- [ ] **Step 1: `login/page.tsx` — searchParams.returnTo를 hidden input으로 전달**

파일 전체를 다음으로 교체:
```tsx
import { login } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; returnTo?: string }> }) {
  const { error, returnTo } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        <form action={login} className="mt-6 space-y-4">
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <div className="space-y-2"><Label htmlFor="email">이메일</Label><Input id="email" name="email" type="email" required /></div>
          <div className="space-y-2"><Label htmlFor="password">비밀번호</Label><Input id="password" name="password" type="password" required /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">로그인</Button>
        </form>
        <a href="/signup" className="mt-4 block text-sm underline">계정이 없으신가요? 가입</a>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: `actions.ts` — login에서 returnTo 검증 후 리다이렉트**

상단 import에 추가:
```ts
import { isSafeInternalPath } from "@/lib/access/safe-redirect";
```

`login` 함수를 다음으로 교체:
```ts
export async function login(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const returnTo = formData.get("returnTo");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const qs = isSafeInternalPath(returnTo) ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
    return redirect(`/login?error=${encodeURIComponent(error.message)}${qs}`);
  }
  redirect(isSafeInternalPath(returnTo) ? returnTo : "/dashboard");
}
```

- [ ] **Step 3: 타입체크 + 린트** — Run `npx tsc --noEmit` && `npm run lint` → 통과.
- [ ] **Step 4: 커밋**
```bash
git add "app/(auth)/login/page.tsx" "app/(auth)/actions.ts"
git commit -m "feat: login returnTo redirect (Phase 5 Stage 2b)"
```

---

## Task 7: BFF `GET`·`POST /api/p/[publicId]/pins`

**Files:** Create `app/api/p/[publicId]/pins/route.ts`

- [ ] **Step 1: 작성**
```ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pinComments, proposalVariants, proposalVersions, proposalPages } from "@/drizzle/schema";
import { resolveViewerGate } from "@/lib/access/viewer-gate";
import { getProfile } from "@/lib/auth/session";
import { validateChatBody } from "@/lib/meeting/chat"; // 범용 본문 검증(≤2000, trim) 재사용
import { clamp01 } from "@/lib/realtime/coords";
import { loadPinsForVersion } from "@/lib/pins/load-pins";
import type { PinDTO } from "@/lib/pins/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal || decision !== "allow") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const variantId = req.nextUrl.searchParams.get("variant") ?? "";
  const versionId = req.nextUrl.searchParams.get("version") ?? "";
  if (!variantId || !versionId) return NextResponse.json({ error: "BAD_QUERY" }, { status: 400 });

  // 소속 확인: variant가 이 proposal 것인지.
  const v = await db.select({ id: proposalVariants.id }).from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, proposal.id))).limit(1);
  if (v.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const pins = await loadPinsForVersion(variantId, versionId);
  return NextResponse.json({ pins });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal || decision !== "allow") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const body = validateChatBody(json?.body);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const variantId = typeof json?.variantId === "string" ? json.variantId : "";
  const versionId = typeof json?.versionId === "string" ? json.versionId : "";
  const pageOrder = Number(json?.pageOrder);
  const authorColor = typeof json?.authorColor === "string" ? json.authorColor.trim().slice(0, 32) : "";
  if (!variantId || !versionId || !Number.isInteger(pageOrder) || pageOrder < 0 || !authorColor) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  // 소속 검증: variant→proposal, version→variant, page_order가 그 버전 페이지 범위.
  const v = await db.select({ id: proposalVariants.id }).from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, proposal.id))).limit(1);
  if (v.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const ver = await db.select({ id: proposalVersions.id }).from(proposalVersions)
    .where(and(eq(proposalVersions.id, versionId), eq(proposalVersions.variantId, variantId))).limit(1);
  if (ver.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const pg = await db.select({ id: proposalPages.id }).from(proposalPages)
    .where(and(eq(proposalPages.versionId, versionId), eq(proposalPages.pageOrder, pageOrder))).limit(1);
  if (pg.length === 0) return NextResponse.json({ error: "BAD_PAGE" }, { status: 400 });

  const id = randomUUID();
  const createdAt = new Date();
  const authorName = profile.displayName ?? profile.email.split("@")[0] ?? "사용자";
  const xNorm = clamp01(Number(json?.xNorm));
  const yNorm = clamp01(Number(json?.yNorm));

  await db.insert(pinComments).values({
    id, proposalId: proposal.id, variantId, versionId, pageOrder, xNorm, yNorm,
    authorId: profile.id, authorName, authorColor, body, createdAt,
  });

  const pin: PinDTO = {
    id, variantId, versionId, pageOrder, xNorm, yNorm,
    authorId: profile.id, authorName, authorColor, body, resolved: false,
    createdAt: createdAt.toISOString(),
  };
  return NextResponse.json({ pin });
}
```

- [ ] **Step 2: 타입체크** — Run `npx tsc --noEmit` → 통과.
- [ ] **Step 3: 커밋**
```bash
git add "app/api/p/[publicId]/pins/route.ts"
git commit -m "feat: BFF pins GET/POST with gate + session + membership (Phase 5 Stage 2b)"
```

---

## Task 8: BFF `PATCH`·`DELETE /api/p/[publicId]/pins/[pinId]`

**Files:** Create `app/api/p/[publicId]/pins/[pinId]/route.ts`

PATCH는 `{ body }`(작성자만) **또는** `{ resolved }`(로그인 누구나) 정확히 하나. DELETE는 작성자만.

- [ ] **Step 1: 작성**
```ts
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pinComments } from "@/drizzle/schema";
import { resolveViewerGate } from "@/lib/access/viewer-gate";
import { getProfile } from "@/lib/auth/session";
import { validateChatBody } from "@/lib/meeting/chat";
import type { PinDTO } from "@/lib/pins/types";

function toDTO(r: typeof pinComments.$inferSelect): PinDTO {
  return {
    id: r.id, variantId: r.variantId, versionId: r.versionId, pageOrder: r.pageOrder,
    xNorm: r.xNorm, yNorm: r.yNorm, authorId: r.authorId, authorName: r.authorName,
    authorColor: r.authorColor, body: r.body, resolved: r.resolved, createdAt: r.createdAt.toISOString(),
  };
}

async function gateAndLoad(publicId: string, pinId: string) {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal || decision !== "allow") return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  const profile = await getProfile();
  if (!profile) return { error: NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 }) };
  const rows = await db.select().from(pinComments)
    .where(and(eq(pinComments.id, pinId), eq(pinComments.proposalId, proposal.id))).limit(1);
  if (rows.length === 0) return { error: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }) };
  return { error: null, profile, pin: rows[0] }; // error:null → 호출부 `if (g.error)` 내로잉으로 profile/pin 사용 가능
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ publicId: string; pinId: string }> }) {
  const { publicId, pinId } = await params;
  const g = await gateAndLoad(publicId, pinId);
  if (g.error) return g.error;
  const { profile, pin } = g;

  const json = await req.json().catch(() => null);
  const hasBody = typeof json?.body === "string";
  const hasResolved = typeof json?.resolved === "boolean";
  if (hasBody === hasResolved) return NextResponse.json({ error: "ONE_FIELD" }, { status: 400 }); // 정확히 하나

  if (hasBody) {
    if (pin.authorId !== profile.id) return NextResponse.json({ error: "NOT_AUTHOR" }, { status: 403 });
    const body = validateChatBody(json.body);
    if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    await db.update(pinComments).set({ body }).where(eq(pinComments.id, pinId));
    return NextResponse.json({ pin: toDTO({ ...pin, body }) });
  }
  // resolved: 로그인 누구나
  await db.update(pinComments).set({ resolved: json.resolved }).where(eq(pinComments.id, pinId));
  return NextResponse.json({ pin: toDTO({ ...pin, resolved: json.resolved }) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ publicId: string; pinId: string }> }) {
  const { publicId, pinId } = await params;
  const g = await gateAndLoad(publicId, pinId);
  if (g.error) return g.error;
  const { profile, pin } = g;
  if (pin.authorId !== profile.id) return NextResponse.json({ error: "NOT_AUTHOR" }, { status: 403 });
  await db.delete(pinComments).where(eq(pinComments.id, pinId));
  return NextResponse.json({ id: pinId });
}
```

- [ ] **Step 2: 타입체크** — Run `npx tsc --noEmit` → 통과.
- [ ] **Step 3: 커밋**
```bash
git add "app/api/p/[publicId]/pins/[pinId]/route.ts"
git commit -m "feat: BFF pin PATCH(body author / resolved any)+DELETE author (Phase 5 Stage 2b)"
```

---

## Task 9: Provider 확장 — `myColor` + 핀 pub/sub + broadcast

**Files:** Modify `components/realtime/realtime-provider.tsx`

채팅과 달리 핀은 버전 스코프라 상태를 PinLayer가 소유한다. provider는 `pin`/`pin_updated`/`pin_deleted` broadcast를 **subscribe 이전** 등록해 구독자(PinLayer)에게 중계만 한다.

- [ ] **Step 1: import 추가** — `import type { ChatMessageDTO } ...` 아래에:
```ts
import type { PinDTO, PinEvent } from "@/lib/pins/types";
```

- [ ] **Step 2: context 타입 확장** — `type RealtimeContextValue = { ... }`에 필드 추가:
```ts
  myColor: string;
  subscribePins: (handler: (e: PinEvent) => void) => () => void;
  broadcastPin: (pin: PinDTO) => void;
  broadcastPinUpdated: (pin: PinDTO) => void;
  broadcastPinDeleted: (id: string) => void;
```

- [ ] **Step 3: 구독자 ref 추가** — `const [chatMessages, ...] = useState(...)` 아래에:
```ts
  const pinSubsRef = useRef(new Set<(e: PinEvent) => void>());
```

- [ ] **Step 4: 핀 broadcast 수신 등록 (subscribe 이전)** — chat `.on(...)` 블록 **바로 아래**(`ch.subscribe` 위)에:
```ts
    ch.on("broadcast", { event: "pin" }, ({ payload }) => {
      const pin = payload as PinDTO;
      if (!pin?.id) return;
      pinSubsRef.current.forEach((h) => h({ type: "pin", pin }));
    });
    ch.on("broadcast", { event: "pin_updated" }, ({ payload }) => {
      const pin = payload as PinDTO;
      if (!pin?.id) return;
      pinSubsRef.current.forEach((h) => h({ type: "pin_updated", pin }));
    });
    ch.on("broadcast", { event: "pin_deleted" }, ({ payload }) => {
      const id = (payload as { id?: string }).id;
      if (!id) return;
      pinSubsRef.current.forEach((h) => h({ type: "pin_deleted", id }));
    });
```

- [ ] **Step 5: subscribe + broadcast 헬퍼 추가** — `sendChat` useCallback 아래에:
```ts
  const subscribePins = useCallback((handler: (e: PinEvent) => void) => {
    pinSubsRef.current.add(handler);
    return () => { pinSubsRef.current.delete(handler); };
  }, []);

  const broadcastPin = useCallback((pin: PinDTO) => {
    const ch = channelRef.current;
    if (ch?.state === "joined") ch.send({ type: "broadcast", event: "pin", payload: pin });
  }, []);
  const broadcastPinUpdated = useCallback((pin: PinDTO) => {
    const ch = channelRef.current;
    if (ch?.state === "joined") ch.send({ type: "broadcast", event: "pin_updated", payload: pin });
  }, []);
  const broadcastPinDeleted = useCallback((id: string) => {
    const ch = channelRef.current;
    if (ch?.state === "joined") ch.send({ type: "broadcast", event: "pin_deleted", payload: { id } });
  }, []);
```

- [ ] **Step 6: context value에 노출** — `value={{ ... }}`를 다음으로 교체:
```tsx
    <RealtimeContext.Provider value={{ participants, cursors, sendCursor, clearCursor, chatMessages, sendChat, myColor: identity.color, subscribePins, broadcastPin, broadcastPinUpdated, broadcastPinDeleted }}>
```

- [ ] **Step 7: 타입체크 + 커밋** — Run `npx tsc --noEmit` → 통과(기존 소비자는 추가 필드 무시).
```bash
git add components/realtime/realtime-provider.tsx
git commit -m "feat: realtime provider pin pub/sub + myColor (Phase 5 Stage 2b)"
```

---

## Task 10: `usePins` 훅 (GET + 구독 + CRUD)

**Files:** Create `lib/pins/use-pins.ts`

활성(variant,version)의 핀을 GET로 적재하고, provider 핀 이벤트를 그 버전 기준으로 병합한다. CRUD는 BFF 호출 성공 후 로컬 반영 + broadcast.

- [ ] **Step 1: 작성**
```ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { useRealtimeOptional } from "@/components/realtime/realtime-provider";
import type { PinContext, PinDTO } from "@/lib/pins/types";

export function usePins(pin: PinContext) {
  const rt = useRealtimeOptional();
  const [pins, setPins] = useState<PinDTO[]>([]);
  const { publicId, variantId, versionId } = pin;

  // 활성 버전 핀 로드(버전 전환마다).
  useEffect(() => {
    let alive = true;
    fetch(`/api/p/${publicId}/pins?variant=${variantId}&version=${versionId}`)
      .then((r) => (r.ok ? r.json() : { pins: [] }))
      .then((d) => { if (alive) setPins(d.pins ?? []); })
      .catch(() => { if (alive) setPins([]); });
    return () => { alive = false; };
  }, [publicId, variantId, versionId]);

  // 실시간 병합(현재 버전 대상만).
  useEffect(() => {
    if (!rt) return;
    return rt.subscribePins((e) => {
      if (e.type === "pin_deleted") { setPins((prev) => prev.filter((p) => p.id !== e.id)); return; }
      const p = e.pin;
      if (p.variantId !== variantId || p.versionId !== versionId) return;
      setPins((prev) => {
        const exists = prev.some((x) => x.id === p.id);
        return exists ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p];
      });
    });
  }, [rt, variantId, versionId]);

  const createPin = useCallback(async (input: { pageOrder: number; xNorm: number; yNorm: number; body: string }) => {
    const res = await fetch(`/api/p/${publicId}/pins`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, versionId, authorColor: rt?.myColor ?? "#3b82f6", ...input }),
    });
    if (!res.ok) return false;
    const { pin: saved } = await res.json();
    setPins((prev) => (prev.some((x) => x.id === saved.id) ? prev : [...prev, saved]));
    rt?.broadcastPin(saved);
    return true;
  }, [rt, publicId, variantId, versionId]);

  const editPin = useCallback(async (id: string, body: string) => {
    const res = await fetch(`/api/p/${publicId}/pins/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
    });
    if (!res.ok) return false;
    const { pin: saved } = await res.json();
    setPins((prev) => prev.map((x) => (x.id === id ? saved : x)));
    rt?.broadcastPinUpdated(saved);
    return true;
  }, [rt, publicId]);

  const toggleResolved = useCallback(async (id: string, resolved: boolean) => {
    const res = await fetch(`/api/p/${publicId}/pins/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolved }),
    });
    if (!res.ok) return false;
    const { pin: saved } = await res.json();
    setPins((prev) => prev.map((x) => (x.id === id ? saved : x)));
    rt?.broadcastPinUpdated(saved);
    return true;
  }, [rt, publicId]);

  const deletePin = useCallback(async (id: string) => {
    const res = await fetch(`/api/p/${publicId}/pins/${id}`, { method: "DELETE" });
    if (!res.ok) return false;
    setPins((prev) => prev.filter((x) => x.id !== id));
    rt?.broadcastPinDeleted(id);
    return true;
  }, [rt, publicId]);

  return { pins, createPin, editPin, toggleResolved, deletePin };
}
```

- [ ] **Step 2: 타입체크** — Run `npx tsc --noEmit` → 통과.
- [ ] **Step 3: 커밋**
```bash
git add lib/pins/use-pins.ts
git commit -m "feat: usePins hook — load + live merge + CRUD (Phase 5 Stage 2b)"
```

---

## Task 11: 프리뷰 배선 — `pageOrder` + pinContext 전달

**Files:** Modify `lib/preview/types.ts` · `lib/preview/load-variants.ts` · `app/p/[publicId]/page.tsx` · `components/preview/public-viewer.tsx` · `components/preview/proposal-preview.tsx`

- [ ] **Step 1: `lib/preview/types.ts` — PreviewPage에 pageOrder**
```ts
// A single rendered page: signed read URL + native pixel dimensions + version page order.
export type PreviewPage = { id: string; url: string; width: number; height: number; pageOrder: number };
```

- [ ] **Step 2: `lib/preview/load-variants.ts` — 매핑에 pageOrder 포함**

`list.push({ id: pg.id, url: ..., width: pg.width, height: pg.height });` 줄을:
```ts
    list.push({ id: pg.id, url: urlByPath.get(pg.storagePath) ?? "", width: pg.width, height: pg.height, pageOrder: pg.pageOrder });
```

- [ ] **Step 3: `app/p/[publicId]/page.tsx` — PublicViewer에 publicId·viewer 전달**

`const { proposal, decision } = await resolveViewerGate(publicId);`를:
```ts
  const { proposal, decision, viewer } = await resolveViewerGate(publicId);
```
`return <PublicViewer variants={variants} />;`를:
```ts
  return <PublicViewer variants={variants} publicId={publicId} viewer={viewer} />;
```

- [ ] **Step 4: `components/preview/public-viewer.tsx` — pinContext 산출 + 전달**

import 추가:
```ts
import type { PinContext } from "@/lib/pins/types";
```
시그니처 교체:
```ts
export function PublicViewer({ variants, publicId, viewer }: {
  variants: ViewerVariant[]; publicId: string; viewer: { id: string } | null;
}) {
```
활성 변형 분기(`if (active) { ... }`) 안에서 `<ProposalPreview key={active.slug} pages={active.pages} />`를 다음으로 교체:
```tsx
        {(() => {
          const pin: PinContext | undefined = active.currentVersionId
            ? { publicId, variantId: active.id, versionId: active.currentVersionId, viewerId: viewer?.id ?? null }
            : undefined;
          return <ProposalPreview key={active.slug} pages={active.pages} pin={pin} />;
        })()}
```

- [ ] **Step 5: `components/preview/proposal-preview.tsx` — pin prop을 CanvasView로**

import 추가:
```ts
import type { PinContext } from "@/lib/pins/types";
```
시그니처 교체:
```ts
export function ProposalPreview({ pages, pin }: { pages: PreviewPage[]; pin?: PinContext }) {
```
`<CanvasView pages={pages} />`를:
```tsx
        {view === "fullscreen" ? <FullscreenSlides pages={pages} /> : <CanvasView pages={pages} pin={pin} />}
```

- [ ] **Step 6: 타입체크** — Run `npx tsc --noEmit` → CanvasView가 아직 `pin` prop을 안 받아 **에러 1건 예상**(Task 13에서 해소). 그 외 신규 에러 없음.
- [ ] **Step 7: 커밋**
```bash
git add lib/preview/types.ts lib/preview/load-variants.ts "app/p/[publicId]/page.tsx" components/preview/public-viewer.tsx components/preview/proposal-preview.tsx
git commit -m "feat: thread pageOrder + pinContext to canvas (Phase 5 Stage 2b)"
```

---

## Task 12: `PinLayer` — 마커·팝오버·작성기 (transform 레이어 내부)

**Files:** Create `components/preview/pin-layer.tsx`

contentRef 내부에 렌더되어 줌/팬에 자동 투영되고, 마커·팝오버는 `--inv-scale`로 화면상 일정 크기를 유지한다(커서 라벨과 동일). 박스는 `[data-page-index]` 이미지의 `offset*`(콘텐츠 좌표)에서 측정.

- [ ] **Step 1: 작성**
```tsx
"use client";
import { useState } from "react";
import { toContent } from "@/lib/realtime/coords";
import { locatePin, placePin, type PageBox } from "@/lib/pins/locate";
import { usePins } from "@/lib/pins/use-pins";
import type { PinContext, PinDTO } from "@/lib/pins/types";
import type { PreviewPage } from "@/lib/preview/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Draft = { pageOrder: number; xNorm: number; yNorm: number } | null;
const INV = "scale(var(--inv-scale,5))";

function PinDot({ color, faded }: { color: string; faded?: boolean }) {
  return (
    <span className="block h-3.5 w-3.5 rounded-full border-2 border-white shadow"
      style={{ backgroundColor: color, opacity: faded ? 0.4 : 1 }} />
  );
}

export function PinLayer({ contentRef, pages, pin, mode }: {
  contentRef: React.RefObject<HTMLDivElement | null>;
  pages: PreviewPage[];
  pin: PinContext;
  mode: "pan" | "comment";
}) {
  const { pins, createPin, editPin, toggleResolved, deletePin } = usePins(pin);
  const [draft, setDraft] = useState<Draft>(null);
  const [draftBody, setDraftBody] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const isGuest = pin.viewerId == null;

  function measureBoxes(): PageBox[] {
    const content = contentRef.current;
    if (!content) return [];
    const out: PageBox[] = [];
    content.querySelectorAll<HTMLElement>("[data-page-index]").forEach((el) => {
      const i = Number(el.dataset.pageIndex);
      const po = pages[i]?.pageOrder;
      if (po == null) return;
      out.push({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight, pageOrder: po });
    });
    return out;
  }

  function onCaptureClick(e: React.MouseEvent) {
    const content = contentRef.current;
    if (!content) return;
    const rect = content.getBoundingClientRect();
    const ow = content.offsetWidth;
    if (ow <= 0) return;
    const { cx, cy } = toContent(e.clientX, e.clientY, rect, rect.width / ow);
    const loc = locatePin(cx, cy, measureBoxes());
    if (!loc) return;
    setSelectedId(null);
    setEditingId(null);
    setDraftBody("");
    setDraft(loc);
  }

  async function submitDraft() {
    if (!draft) return;
    const body = draftBody.trim();
    if (!body) return;
    const ok = await createPin({ ...draft, body });
    if (ok) { setDraft(null); setDraftBody(""); }
  }

  const boxesByOrder = new Map(measureBoxes().map((b) => [b.pageOrder, b]));

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* 코멘트 모드에서만 클릭 캡처(일반 모드는 pan 통과) */}
      {mode === "comment" && <div className="pointer-events-auto absolute inset-0" onClick={onCaptureClick} />}

      {/* 저장된 핀 */}
      {pins.map((p) => {
        const b = boxesByOrder.get(p.pageOrder);
        if (!b) return null;
        const { x, y } = placePin(b, p.xNorm, p.yNorm);
        const mine = !isGuest && p.authorId === pin.viewerId;
        const open = selectedId === p.id;
        return (
          <div key={p.id} className="absolute" style={{ left: x, top: y }}>
            <button className="pointer-events-auto block"
              style={{ transform: INV, transformOrigin: "0 100%" }}
              onClick={(e) => { e.stopPropagation(); setDraft(null); setEditingId(null); setSelectedId(open ? null : p.id); }}>
              <PinDot color={p.authorColor} faded={p.resolved} />
            </button>
            {open && (
              <div className="pointer-events-auto absolute left-2 top-0 w-56 rounded-lg border border-border bg-background p-3 text-sm shadow-lg"
                style={{ transform: INV, transformOrigin: "0 0" }}>
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: p.authorColor }}>{p.authorName}</span>
                  <button className="text-xs text-muted-foreground" onClick={() => setSelectedId(null)}>닫기</button>
                </div>
                {editingId === p.id ? (
                  <form onSubmit={async (e) => { e.preventDefault(); if (await editPin(p.id, editBody.trim())) setEditingId(null); }} className="mt-2 space-y-2">
                    <Input value={editBody} onChange={(e) => setEditBody(e.target.value)} maxLength={2000} className="h-8" aria-label="코멘트 수정" />
                    <div className="flex gap-1">
                      <Button type="submit" size="sm" className="h-7" disabled={!editBody.trim()}>저장</Button>
                      <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setEditingId(null)}>취소</Button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap break-words">{p.body}</p>
                )}
                {!isGuest && editingId !== p.id && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="underline" onClick={() => toggleResolved(p.id, !p.resolved)}>
                      {p.resolved ? "재오픈" : "처리됨"}
                    </button>
                    {mine && <button className="underline" onClick={() => { setEditBody(p.body); setEditingId(p.id); }}>수정</button>}
                    {mine && <button className="text-destructive underline" onClick={() => deletePin(p.id)}>삭제</button>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 작성 중(draft) */}
      {draft && (() => {
        const b = boxesByOrder.get(draft.pageOrder);
        if (!b) return null;
        const { x, y } = placePin(b, draft.xNorm, draft.yNorm);
        return (
          <div className="absolute" style={{ left: x, top: y }}>
            <span className="block" style={{ transform: INV, transformOrigin: "0 100%" }}><PinDot color="#3b82f6" /></span>
            <div className="pointer-events-auto absolute left-2 top-0 w-56 rounded-lg border border-border bg-background p-3 text-sm shadow-lg"
              style={{ transform: INV, transformOrigin: "0 0" }}>
              {isGuest ? (
                <div className="space-y-2">
                  <p>핀을 남기려면 로그인이 필요합니다.</p>
                  <a className="inline-block underline" href={`/login?returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/")}`}>로그인</a>
                  <button className="ml-2 text-xs text-muted-foreground" onClick={() => setDraft(null)}>닫기</button>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); submitDraft(); }} className="space-y-2">
                  <Input autoFocus value={draftBody} onChange={(e) => setDraftBody(e.target.value)} maxLength={2000} placeholder="코멘트 입력" className="h-8" aria-label="코멘트 입력" />
                  <div className="flex gap-1">
                    <Button type="submit" size="sm" className="h-7" disabled={!draftBody.trim()}>저장</Button>
                    <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setDraft(null)}>취소</Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크** — Run `npx tsc --noEmit` → Task 11의 잔여 에러(CanvasView가 pin 미수신)만 남고 PinLayer 자체 신규 에러 없음.
- [ ] **Step 3: 커밋**
```bash
git add components/preview/pin-layer.tsx
git commit -m "feat: PinLayer markers + popover + composer + login prompt (Phase 5 Stage 2b)"
```

---

## Task 13: CanvasView — 모드 토글 + `data-page-index` + PinLayer 배선

**Files:** Modify `components/preview/canvas-view.tsx`

- [ ] **Step 1: 파일 전체를 다음으로 교체**
```tsx
"use client";
import { useCallback, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { PreviewPage } from "@/lib/preview/types";
import type { PinContext } from "@/lib/pins/types";
import { CanvasCursorLayer, CanvasCursorCapture } from "@/components/realtime/canvas-cursors";
import { PinLayer } from "./pin-layer";
import { Button } from "@/components/ui/button";

export function CanvasView({ pages, pin }: { pages: PreviewPage[]; pin?: PinContext }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"pan" | "comment">("pan");

  const applyInvScale = useCallback((scale: number) => {
    const el = contentRef.current;
    if (el && scale > 0) el.style.setProperty("--inv-scale", String(1 / scale));
  }, []);

  if (pages.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground">페이지가 없습니다.</div>;
  }

  const commenting = !!pin && mode === "comment";

  return (
    <div ref={rootRef} className="relative h-full w-full bg-muted">
      {pin && (
        <div className="absolute left-3 top-3 z-10 flex gap-1 rounded-md border border-border bg-background/90 p-1 shadow-sm backdrop-blur">
          <Button size="sm" variant={mode === "pan" ? "default" : "outline"} className="h-7" onClick={() => setMode("pan")}>일반</Button>
          <Button size="sm" variant={mode === "comment" ? "default" : "outline"} className="h-7" onClick={() => setMode("comment")}>코멘트</Button>
        </div>
      )}
      <TransformWrapper
        minScale={0.1}
        maxScale={3}
        initialScale={0.2}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.001 }}
        panning={{ disabled: commenting }}
        onInit={(ref) => applyInvScale(ref.state.scale)}
        onTransform={(_ref, state) => applyInvScale(state.scale)}
      >
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div ref={contentRef} style={{ position: "relative", width: "max-content" }}>
            <div style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start", gap: "3rem", padding: "2rem", width: "max-content" }}>
              {pages.map((pg, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={pg.id} data-page-index={i} src={pg.url} alt="" width={pg.width} height={pg.height} draggable={false}
                  className="block max-w-none shrink-0 select-none border border-border bg-background" />
              ))}
            </div>
            <CanvasCursorLayer />
            {pin && <PinLayer contentRef={contentRef} pages={pages} pin={pin} mode={mode} />}
          </div>
        </TransformComponent>
        <CanvasCursorCapture rootRef={rootRef} contentRef={contentRef} />
      </TransformWrapper>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 린트** — Run `npx tsc --noEmit` && `npm run lint` → **에러 0**(Task 11 잔여 해소).
- [ ] **Step 3: 커밋**
```bash
git add components/preview/canvas-view.tsx
git commit -m "feat: canvas mode toggle + PinLayer wiring (Phase 5 Stage 2b)"
```

---

## Task 14: 마무리 — 전체 검증 + 2탭/로그인 수동 E2E

- [ ] **Step 1: 전체 테스트** — Run `npm run test` → 전부 PASS(신규 locate·safe-redirect 포함).
- [ ] **Step 2: 빌드** — Run `npm run build` → 성공. 라우트 목록에 `/api/p/[publicId]/pins`·`/api/p/[publicId]/pins/[pinId]` 등장.
- [ ] **Step 3: 개발 서버 + 시드** — Run `npm run dev`. 시드: 계정 가입→admin 승격→공개 시안(안 1개, 페이지 ≥2장)·**공개(visibility=public)**. (DB 0 row 시 [[phase1b-db-reconciliation]].)
- [ ] **Step 4: 로그인 작성** — 로그인 상태로 `/p/<id>` → 안 열기 → **캔버스** 모드 → 좌상단 **코멘트** → 페이지 위 클릭 → 인라인 입력 저장 → 마커 표시. 줌/팬 해도 그 지점에 고정·일정 크기.
- [ ] **Step 5: 2탭 실시간** — 다른 탭(같은/다른 로그인)에서 같은 안 열기 → 새 핀이 실시간 등장. resolved 토글·본문 수정·삭제가 양쪽 반영.
- [ ] **Step 6: 소유권** — 타인 핀 팝오버엔 수정/삭제 없음(처리됨만). 타인 핀에 `PATCH {body}`/`DELETE` 직접 호출 시 403.
- [ ] **Step 7: 게스트 유도** — 비로그인(시크릿) 탭에서 공개 시안 캔버스 코멘트 모드 클릭 → **로그인 유도 팝오버** → 로그인 후 `/p/<id>`로 복귀. 게스트는 기존 핀 보기는 되되 컨트롤 없음.
- [ ] **Step 8: 에디터 회귀** — `/dashboard/proposals/[id]` 프리뷰 캔버스는 모드 토글·핀 없음(비실시간 그대로).
- [ ] **Step 9: 완료** — 수동 검증 통과 시 `superpowers:finishing-a-development-branch`로 master ff-merge.

---

## Self-Review

**1. 스펙 커버리지:**
- 캔버스 전용·모드 토글 → Task 13. 인라인 팝오버 → Task 12. ✅
- 좌표(콘텐츠좌표+hit-test+정규화, inv-scale 렌더) → Task 1·12·13. ✅
- 로그인 작성·게스트 유도·returnTo → Task 6·12, 게이트 viewer Task 5·11. ✅
- 소유권(author_id 세션, 수정·삭제 작성자, resolved 로그인 누구나) → Task 7·8. ✅
- 데이터 모델 + RLS → Task 3. BFF GET/POST/PATCH/DELETE → Task 7·8. ✅
- 실시간 pin/pin_updated/pin_deleted → Task 9·10. ✅
- author_name/​id 서버 세션, color 클라 → Task 7. ✅
- 순수 테스트(locate, returnTo) → Task 1·2. ✅
- 범위 외(스레드/필터/풀화면·리스트·비교 핀) 미구현 유지. ✅

**2. 플레이스홀더 스캔:** 모든 코드 스텝에 실제 코드/명령/기대출력. TBD 없음. ✅

**3. 타입 일관성:**
- `PinDTO`(types.ts) — load-pins·route·route[pinId]·provider·use-pins·pin-layer 동일. ✅
- `PinEvent`/`subscribePins`/`broadcastPin(Updated|Deleted)` — provider 정의 ↔ use-pins 호출 일치. ✅
- `PinContext { publicId, variantId, versionId, viewerId }` — public-viewer 생성 ↔ proposal-preview ↔ canvas-view ↔ pin-layer ↔ use-pins 일치. ✅
- `PageBox`/`locatePin`/`placePin` — locate.ts ↔ pin-layer 일치. ✅
- `PreviewPage.pageOrder` — types ↔ load-variants ↔ pin-layer(measureBoxes) 일치. ✅
- `resolveViewerGate().viewer` — viewer-gate ↔ page.tsx ↔ public-viewer 일치. ✅
- 본문 검증은 `validateChatBody`(범용) 재사용 — route·route[pinId] 일치. ✅
