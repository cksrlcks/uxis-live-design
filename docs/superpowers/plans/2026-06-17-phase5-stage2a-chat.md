# Phase 5 Stage 2a — 채팅(저장형) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 뷰어 `/p/[publicId]`에 시안 단위 1개 방의 **저장형 채팅**을 올린다 — 메시지는 DB에 남고, BFF 게이트를 통과한 참여자끼리 실시간으로 주고받으며, 재접속 시에도 보인다.

**Architecture:** 채팅 상태는 안 전환(`?v=`/`?compare=`)에도 끊기지 않아야 하므로, 채널을 들고 있는 **레이아웃 상주 셸**(`app/p/[publicId]/layout.tsx` → `RealtimeShell` → `RealtimeProvider`)에 채팅을 얹는다. 초기 메시지 N개는 **서버 컴포넌트(layout)에서 1차 로드**해 셸에 주입(빈 화면 깜빡임 방지), 이후 broadcast로 증분한다. 쓰기는 BFF 라우트 `POST /api/p/[publicId]/chat` 한 곳으로만 — 요청마다 기존 `resolveViewerGate`로 view-access를 재검증(403 deny)하고, 본문 검증 후 Drizzle pooler로 저장한 뒤 저장된 행을 반환하면 클라가 그 행을 broadcast한다. `chat_messages` 테이블은 RLS `FORCE` deny 백스톱.

**Tech Stack:** Next.js(App Router) · Drizzle(postgres-js, Supabase pooler) · Supabase Realtime(공개 채널, anon) · Vitest · Tailwind/shadcn.

---

## 범위 / 스코프 결정 (planning 중 확정)

- 상위 스펙: `docs/superpowers/specs/2026-06-16-phase5-realtime-meeting-design.md` (§5 Stage 2).
- 스펙의 **Stage 2 = 채팅 + 핀 코멘트**이지만, 핀은 프리뷰 좌표계(풀화면 슬라이드 인덱스 / 캔버스 줌·팬·rect)와 깊게 얽혀 별도 설계·plan이 필요하다. writing-plans Scope Check(독립 서브시스템 분리)에 따라 Stage 2를 둘로 나눈다:
  - **Stage 2a — 채팅** (이 plan). 시안 단위로 자족적, 프리뷰 좌표 비의존.
  - **Stage 2b — 핀 코멘트** (후속 plan). `pin_comments` + `PinLayer` + 프리뷰 좌표 배선.
- **스펙 대비 의도적 차이(채택 이유 명시):**
  1. **`lib/access/view-access.ts`(`canViewProposal`) 미생성** — 동일 역할을 이미 하는 `resolveViewerGate(publicId)`(세션+unlock 쿠키+`decideAccess`를 묶어 `{proposal, decision}` 반환)를 재사용한다. BFF는 `decision === "allow"`로 게이트하고 `proposal.id`를 그대로 쓴다. (DRY)
  2. **셸은 layout에 상주**(스펙 §3 다이어그램은 page.tsx 래핑) — Stage 1에서 이미 layout가 셸을 마운트해 안 전환에도 채널이 유지된다. 채팅 초기 로드도 layout(게이트가 `proposal`을 반환)에서 한다.
  3. **`GET /api/p/[publicId]/chat` 미구현(YAGNI)** — 초기 메시지는 layout 서버 주입으로, 증분은 broadcast로 모두 커버된다(스펙 §5.3도 "초기 채팅은 서버 컴포넌트에서 1차 로드"를 1순위로 명시). 페이지네이션/older-load가 실제로 필요해지면 그때 추가.
  4. broadcast `chat` payload 필드명은 DB 컬럼과 일치시켜 `authorName`/`authorColor` 사용(스펙의 `{name,color}`는 예시 표기).

## File Structure

```
lib/meeting/chat.ts             MAX_CHAT_BODY + validateChatBody (순수·TDD)
lib/meeting/types.ts            ChatMessageDTO (서버주입·broadcast·클라 상태 공통 형태, createdAt: ISO string)
lib/meeting/load-chat.ts        loadRecentChat(proposalId) — 최근 N개를 DTO로 (server only)
app/api/p/[publicId]/chat/route.ts   POST: view-access 게이트 → 검증 → 저장 → 저장행 반환 (BFF)
drizzle/schema.ts               chat_messages 테이블 + ChatMessage 타입 (modify)
drizzle/migrations/0005_*.sql   생성 후 본문을 canonical SQL로 교체 (table+FK+index+RLS)
scripts/check-proposals.mts     RLS 점검 목록에 chat_messages 추가 (modify)
components/realtime/realtime-provider.tsx   chatMessages 상태 + sendChat + chat broadcast 수신 (modify)
components/realtime/realtime-shell.tsx      initialChat 주입 + <ChatPanel> 렌더 (modify)
components/realtime/chat-panel.tsx          채팅 패널 UI (create)
app/p/[publicId]/layout.tsx     loadRecentChat → initialChat 주입 (modify)
tests/meeting/chat.test.ts      validateChatBody 단위 테스트 (create)
```

## 작업 브랜치

시작 전, master(클린)에서 작업 브랜치를 만든다:

```bash
git switch -c feat/phase5-chat
```

스펙 §9대로 태스크별 작은 커밋, 커밋마다 `npx tsc --noEmit`(+해당 시 Vitest) 게이트. 완료·수동검증 후 master로 ff-merge.

---

## Task 1: 채팅 본문 검증 헬퍼 (순수·TDD)

**Files:**
- Create: `lib/meeting/chat.ts`
- Test: `tests/meeting/chat.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/meeting/chat.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { MAX_CHAT_BODY, validateChatBody } from "@/lib/meeting/chat";

describe("validateChatBody", () => {
  it("trims and returns a valid body", () => {
    expect(validateChatBody("  hello  ")).toBe("hello");
  });
  it("rejects non-strings", () => {
    expect(validateChatBody(123)).toBeNull();
    expect(validateChatBody(null)).toBeNull();
    expect(validateChatBody(undefined)).toBeNull();
    expect(validateChatBody({})).toBeNull();
  });
  it("rejects empty / whitespace-only", () => {
    expect(validateChatBody("")).toBeNull();
    expect(validateChatBody("   ")).toBeNull();
  });
  it("accepts a body exactly at the limit", () => {
    expect(validateChatBody("a".repeat(MAX_CHAT_BODY))).toBe("a".repeat(MAX_CHAT_BODY));
  });
  it("rejects a body over the limit (after trim)", () => {
    expect(validateChatBody("a".repeat(MAX_CHAT_BODY + 1))).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/meeting/chat.test.ts`
Expected: FAIL — `lib/meeting/chat` 모듈 없음(해석 실패).

- [ ] **Step 3: 최소 구현**

`lib/meeting/chat.ts`:
```ts
export const MAX_CHAT_BODY = 2000;

// 클라이언트가 보낸 본문을 trim한 뒤 1..MAX_CHAT_BODY 글자면 그 문자열을, 아니면 null을 반환.
export function validateChatBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const body = raw.trim();
  if (body.length === 0 || body.length > MAX_CHAT_BODY) return null;
  return body;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/meeting/chat.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/meeting/chat.ts tests/meeting/chat.test.ts
git commit -m "feat: chat body validator (Phase 5 Stage 2a)"
```

---

## Task 2: 스키마 + 마이그레이션 (`chat_messages`)

**Files:**
- Modify: `drizzle/schema.ts`
- Create: `drizzle/migrations/0005_*.sql` (db:generate 후 본문 교체)
- Modify: `scripts/check-proposals.mts:3`

> ⚠️ 이 태스크는 공유 라이브 DB를 변경한다. 적용 전 `.env.local`의 DB ref를 확인할 것. 마이그레이션은 **repo가 단일 진실원**이다(레포 밖 적용 금지 — `drizzle/README.md`, [[phase1b-db-reconciliation]]). Node ≥22 필요.

- [ ] **Step 1: `drizzle/schema.ts` — import에 `index` 추가**

1번째 줄을 다음으로 교체:
```ts
import { pgTable, uuid, text, timestamp, integer, unique, check, index } from "drizzle-orm/pg-core";
```

- [ ] **Step 2: `drizzle/schema.ts` 맨 끝에 `chat_messages` 테이블 + 타입 추가**

파일 끝(기존 타입 export 블록 아래)에 추가:
```ts
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull(),     // FK added via SQL (기존 컨벤션)
  authorName: text("author_name").notNull(),
  authorColor: text("author_color").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("chat_messages_proposal_created_idx").on(t.proposalId, t.createdAt),
]);

export type ChatMessage = typeof chatMessages.$inferSelect;
```

- [ ] **Step 3: 마이그레이션 생성**

Run: `npm run db:generate`
Expected: `drizzle/migrations/0005_<random>.sql` + `meta/0005_snapshot.json` 생성, `_journal.json` 갱신. (생성된 `.sql`은 CREATE TABLE + CREATE INDEX만 담는다 — FK·RLS는 스키마에 선언하지 않으므로 다음 스텝에서 canonical 본문으로 교체한다. 스냅샷/journal은 그대로 둔다.)

- [ ] **Step 4: 생성된 `0005_*.sql` 본문을 아래로 전체 교체**

```sql
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"author_color" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_proposal_id_proposals_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "chat_messages_proposal_created_idx" ON "chat_messages" ("proposal_id","created_at");
--> statement-breakpoint
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;
```

- [ ] **Step 5: 마이그레이션 적용**

Run: `npm run db:migrate`
Expected: 에러 없이 완료. "already exists"류 에러면 강제 적용 말고 `drizzle.__drizzle_migrations` vs 레포 journal을 먼저 대조([[phase1b-db-reconciliation]]).

- [ ] **Step 6: `scripts/check-proposals.mts` RLS 목록에 `chat_messages` 추가**

3번째 줄을 다음으로 교체:
```ts
for (const rel of ["proposals", "proposal_variants", "proposal_versions", "proposal_pages", "chat_messages"]) {
```

- [ ] **Step 7: 검증 — 타입체크 + RLS 확인**

Run: `npx tsc --noEmit`
Expected: 통과(스키마 문법 OK). 이 시점엔 아직 새 테이블을 쓰는 코드가 없어 신규 에러 없음.

Run: `npx tsx --env-file=.env.local scripts/check-proposals.mts`
Expected: 5개 테이블 모두 `relrowsecurity: true, relforcerowsecurity: true`.

- [ ] **Step 8: 커밋**

```bash
git add drizzle/schema.ts drizzle/migrations scripts/check-proposals.mts
git commit -m "feat: chat_messages table + RLS deny backstop (Phase 5 Stage 2a)"
```

---

## Task 3: 공통 DTO 타입 + 초기 채팅 로더

**Files:**
- Create: `lib/meeting/types.ts`
- Create: `lib/meeting/load-chat.ts`

- [ ] **Step 1: `lib/meeting/types.ts` 작성**

서버 주입·broadcast·클라 상태가 **동일한 형태**를 갖도록 `createdAt`은 ISO 문자열로 직렬화한다(broadcast는 JSON으로 문자열화되므로 일치시킨다).
```ts
// 채팅 메시지의 클라이언트/전송 표현. DB의 ChatMessage(createdAt: Date)와 달리
// createdAt은 ISO 문자열 — 서버 주입(RSC)·broadcast(JSON)·클라 상태가 같은 모양이 된다.
export type ChatMessageDTO = {
  id: string;
  authorName: string;
  authorColor: string;
  body: string;
  createdAt: string; // ISO 8601
};
```

- [ ] **Step 2: `lib/meeting/load-chat.ts` 작성**

```ts
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages } from "@/drizzle/schema";
import type { ChatMessageDTO } from "@/lib/meeting/types";

const INITIAL_CHAT_LIMIT = 50;

// 한 시안의 최근 메시지 N개를 오래된→최신(렌더) 순으로 DTO 반환. DB Date → ISO 문자열.
export async function loadRecentChat(proposalId: string): Promise<ChatMessageDTO[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.proposalId, proposalId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(INITIAL_CHAT_LIMIT);
  return rows
    .reverse()
    .map((r) => ({
      id: r.id,
      authorName: r.authorName,
      authorColor: r.authorColor,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    }));
}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 4: 커밋**

```bash
git add lib/meeting/types.ts lib/meeting/load-chat.ts
git commit -m "feat: chat DTO + initial-load helper (Phase 5 Stage 2a)"
```

---

## Task 4: BFF 라우트 `POST /api/p/[publicId]/chat`

**Files:**
- Create: `app/api/p/[publicId]/chat/route.ts`

요청마다 `resolveViewerGate`로 view-access 재검증(forbidden/need-password → 403), 본문·작성자 검증 후 저장하고 저장된 행을 반환한다(클라가 broadcast). `createdAt`은 명시적으로 넣어 반환값이 저장행과 정확히 일치하게 한다.

- [ ] **Step 1: 라우트 작성**

`app/api/p/[publicId]/chat/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { chatMessages } from "@/drizzle/schema";
import { resolveViewerGate } from "@/lib/access/viewer-gate";
import { validateChatBody } from "@/lib/meeting/chat";
import type { ChatMessageDTO } from "@/lib/meeting/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  // 저장 데이터는 항상 코드 게이트(visibility + unlock)를 통과한 경우에만(스펙 §7).
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal || decision !== "allow") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);

  const body = validateChatBody(json?.body);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  // 작성자 이름/색은 클라(게스트 신원)가 보낸다 — 길이만 방어적으로 제한.
  const authorName =
    typeof json?.authorName === "string" ? json.authorName.trim().slice(0, 80) : "";
  const authorColor =
    typeof json?.authorColor === "string" ? json.authorColor.trim().slice(0, 32) : "";
  if (!authorName || !authorColor) {
    return NextResponse.json({ error: "INVALID_AUTHOR" }, { status: 400 });
  }

  const id = randomUUID();
  const createdAt = new Date();
  await db.insert(chatMessages).values({
    id,
    proposalId: proposal.id,
    authorName,
    authorColor,
    body,
    createdAt,
  });

  const message: ChatMessageDTO = {
    id,
    authorName,
    authorColor,
    body,
    createdAt: createdAt.toISOString(),
  };
  return NextResponse.json({ message });
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add app/api/p/[publicId]/chat/route.ts
git commit -m "feat: BFF POST chat route with view-access gate (Phase 5 Stage 2a)"
```

---

## Task 5: Provider 확장 — 채팅 상태 + 송수신

**Files:**
- Modify: `components/realtime/realtime-provider.tsx`

기존 cursor 패턴을 그대로 따른다: `.on("broadcast", { event: "chat" })`를 **subscribe 이전에** 등록하고, 상태 배열 + send 헬퍼를 context로 노출. broadcast는 `self:false`라 보낸 사람은 자기 메시지를 수신하지 못하므로 `sendChat`이 로컬에도 append한다. 수신·로컬 모두 `id` 기준 dedupe.

- [ ] **Step 1: import에 `ChatMessageDTO` 타입 추가**

기존 import 블록(상단, `import type { Identity } ...` 줄 아래)에 추가:
```ts
import type { ChatMessageDTO } from "@/lib/meeting/types";
```

- [ ] **Step 2: context 타입에 채팅 필드 추가**

`type RealtimeContextValue = { ... }`를 다음으로 교체:
```ts
type RealtimeContextValue = {
  participants: Participant[];
  cursors: RemoteCursor[];
  sendCursor: (cx: number, cy: number) => void;
  clearCursor: () => void;
  chatMessages: ChatMessageDTO[];
  sendChat: (message: ChatMessageDTO) => void;
};
```

- [ ] **Step 3: provider 시그니처에 `initialChat` 추가**

`export function RealtimeProvider({ publicId, identity, children }: { ... })` 블록을 다음으로 교체:
```ts
export function RealtimeProvider({ publicId, identity, initialChat, children }: {
  publicId: string; identity: Identity; initialChat: ChatMessageDTO[]; children: React.ReactNode;
}) {
```

- [ ] **Step 4: 채팅 상태 추가**

`const [cursors, setCursors] = useState<RemoteCursor[]>([]);` 바로 아래에 추가:
```ts
  const [chatMessages, setChatMessages] = useState<ChatMessageDTO[]>(initialChat);
```

- [ ] **Step 5: chat broadcast 수신 핸들러 등록 (subscribe 이전)**

채널 effect 안, `ch.on("broadcast", { event: "cursor_leave" }, ...)` 블록 **바로 아래**(즉 `ch.subscribe(...)` 호출 위)에 추가:
```ts
    ch.on("broadcast", { event: "chat" }, ({ payload }) => {
      const m = payload as ChatMessageDTO;
      setChatMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
```

- [ ] **Step 6: `sendChat` 헬퍼 추가**

`clearCursor` `useCallback` 정의 **바로 아래**에 추가:
```ts
  // 저장 성공(BFF) 후 호출. self:false라 송신자는 자기 broadcast를 못 받으므로 로컬에도 append.
  const sendChat = useCallback((message: ChatMessageDTO) => {
    setChatMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    const ch = channelRef.current;
    if (ch?.state === "joined") {
      ch.send({ type: "broadcast", event: "chat", payload: message });
    }
  }, []);
```

- [ ] **Step 7: context value에 채팅 노출**

`return ( <RealtimeContext.Provider value={{ participants, cursors, sendCursor, clearCursor }}>`를 다음으로 교체:
```ts
  return (
    <RealtimeContext.Provider value={{ participants, cursors, sendCursor, clearCursor, chatMessages, sendChat }}>
```

- [ ] **Step 8: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: `RealtimeProvider`를 호출하는 `realtime-shell.tsx`가 아직 `initialChat`을 안 넘겨 **에러 1건 예상**(다음 Task에서 해소). 그 외 신규 에러 없음. provider 파일 자체 문법 에러가 없는지 확인.

```bash
git add components/realtime/realtime-provider.tsx
git commit -m "feat: realtime provider chat state + sendChat (Phase 5 Stage 2a)"
```

---

## Task 6: ChatPanel 컴포넌트

**Files:**
- Create: `components/realtime/chat-panel.tsx`

접힘/펼침 패널(좌하단; PresenceBar는 우상단). 펼치면 메시지 목록 + 입력. 전송 시 `POST /api/p/[publicId]/chat` → 성공 응답의 저장행을 `sendChat`으로 broadcast+로컬반영. 새 메시지/열림 시 목록 맨 아래로 자동 스크롤.

> ⚠️ 폼 전송 버튼은 반드시 `type="submit"` — 이 프로젝트 Button은 기본 `type="button"`이라 안 주면 폼 제출이 안 된다([[base-ui-button-submit-type]], PresenceBar 선례와 동일).

- [ ] **Step 1: 작성**

`components/realtime/chat-panel.tsx`:
```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useRealtime } from "./realtime-provider";
import type { Identity } from "@/lib/realtime/identity";
import { MAX_CHAT_BODY } from "@/lib/meeting/chat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ChatPanel({ publicId, identity }: { publicId: string; identity: Identity }) {
  const { chatMessages, sendChat } = useRealtime();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // 새 메시지/열림 시 맨 아래로.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chatMessages, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/p/${publicId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, authorName: identity.name, authorColor: identity.color }),
      });
      if (res.ok) {
        const { message } = await res.json();
        sendChat(message);
        setText("");
      }
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-3 left-3 z-50 rounded-full border border-border bg-background/90 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur"
      >
        채팅{chatMessages.length > 0 && <span className="ml-1 text-muted-foreground">{chatMessages.length}</span>}
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 left-3 z-50 flex h-96 w-80 flex-col rounded-lg border border-border bg-background/95 shadow-lg backdrop-blur">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium">채팅</span>
        <button onClick={() => setOpen(false)} className="text-sm text-muted-foreground">닫기</button>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {chatMessages.length === 0 && (
          <p className="text-xs text-muted-foreground">아직 메시지가 없습니다.</p>
        )}
        {chatMessages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-medium" style={{ color: m.authorColor }}>{m.authorName}</span>
            <span className="ml-2 whitespace-pre-wrap break-words">{m.body}</span>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-border p-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_CHAT_BODY}
          placeholder="메시지 입력"
          className="h-8"
        />
        <Button type="submit" size="sm" className="h-8" disabled={sending || !text.trim()}>
          전송
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: Task 5의 잔여 에러(shell이 `initialChat` 미전달)만 남고 ChatPanel 자체 신규 에러 없음. 다음 Task에서 모두 해소.

- [ ] **Step 3: 커밋**

```bash
git add components/realtime/chat-panel.tsx
git commit -m "feat: ChatPanel UI (Phase 5 Stage 2a)"
```

---

## Task 7: 셸 + 레이아웃 배선 (초기 채팅 주입 + 패널 렌더)

**Files:**
- Modify: `components/realtime/realtime-shell.tsx`
- Modify: `app/p/[publicId]/layout.tsx`

- [ ] **Step 1: `realtime-shell.tsx` — import 2줄 추가**

상단 import 블록에 추가:
```ts
import { ChatPanel } from "./chat-panel";
import type { ChatMessageDTO } from "@/lib/meeting/types";
```

- [ ] **Step 2: `realtime-shell.tsx` — 시그니처에 `initialChat` 추가**

`export function RealtimeShell({ publicId, editorName, children }: { publicId: string; editorName: string | null; children: React.ReactNode; })` 블록을 다음으로 교체:
```ts
export function RealtimeShell({ publicId, editorName, initialChat, children }: {
  publicId: string; editorName: string | null; initialChat: ChatMessageDTO[]; children: React.ReactNode;
}) {
```

- [ ] **Step 3: `realtime-shell.tsx` — provider에 initialChat 전달 + ChatPanel 렌더**

`return ( <RealtimeProvider publicId={publicId} identity={identity}> ... </RealtimeProvider> )` 블록을 다음으로 교체:
```tsx
  return (
    <RealtimeProvider publicId={publicId} identity={identity} initialChat={initialChat}>
      {children}
      <PresenceBar identity={identity} onRename={rename} />
      <ChatPanel publicId={publicId} identity={identity} />
    </RealtimeProvider>
  );
```

- [ ] **Step 4: `app/p/[publicId]/layout.tsx` — import 1줄 추가**

상단에 추가:
```ts
import { loadRecentChat } from "@/lib/meeting/load-chat";
```

- [ ] **Step 5: `app/p/[publicId]/layout.tsx` — proposal 받아 초기 채팅 로드 후 주입**

게이트 호출부터 return까지(아래 기존 블록)
```ts
  const { decision, editorName } = await resolveViewerGate(publicId);

  if (decision !== "allow") return <>{children}</>;

  return (
    <RealtimeShell publicId={publicId} editorName={editorName}>
      {children}
    </RealtimeShell>
  );
```
를 다음으로 교체:
```ts
  const { proposal, decision, editorName } = await resolveViewerGate(publicId);

  if (decision !== "allow" || !proposal) return <>{children}</>;

  const initialChat = await loadRecentChat(proposal.id);

  return (
    <RealtimeShell publicId={publicId} editorName={editorName} initialChat={initialChat}>
      {children}
    </RealtimeShell>
  );
```

- [ ] **Step 6: 타입체크 + 린트**

Run: `npx tsc --noEmit`
Expected: 통과(잔여 에러 0).

Run: `npm run lint`
Expected: 통과.

- [ ] **Step 7: 커밋**

```bash
git add components/realtime/realtime-shell.tsx app/p/[publicId]/layout.tsx
git commit -m "feat: wire chat into shell + inject initial messages (Phase 5 Stage 2a)"
```

---

## Task 8: 마무리 — 전체 검증 + 수동 2탭 E2E

**Files:** (없음 — 검증만)

- [ ] **Step 1: 전체 테스트**

Run: `npm run test`
Expected: 전부 PASS(신규 `tests/meeting/chat.test.ts` 포함).

- [ ] **Step 2: 프로덕션 빌드**

Run: `npm run build`
Expected: 에러 없이 빌드 성공.

- [ ] **Step 3: 개발 서버 기동 + 시드 데이터 확인**

Run: `npm run dev`

DB가 비어 있으면(=계정/시안 0) 먼저 [[phase1b-db-reconciliation]]대로 계정 가입 → `role='admin'` 승격 → 시안 1개 생성(안 1개 + 페이지 업로드)하고, **공개(visibility=public)** 로 두거나 비번을 건 뒤 unlock해 둔다. 그 시안의 `/p/<publicId>`를 사용.

- [ ] **Step 4: 두 탭(일반 + 시크릿)으로 같은 공개 뷰어 열기**

각 탭에서 `/p/<publicId>` 열기. 양쪽 좌하단 "채팅" 버튼 → 패널 열기.

- [ ] **Step 5: 실시간 송수신 확인**

- 탭 A에서 메시지 전송 → 탭 A에 즉시 표시(로컬 append).
- 탭 B의 패널에 같은 메시지가 실시간으로 도착(broadcast).
- 탭 B에서 답장 → 탭 A에 도착. 작성자 이름/색이 신원과 일치.
- 안 전환(`?v=`/`?compare=`)·풀화면/캔버스 토글 후에도 채팅 패널·메시지가 **유지**(셸이 layout 상주).

- [ ] **Step 6: 영속성 확인**

- 두 탭 모두 새로고침 → 보낸 메시지가 **그대로 다시 로드**(layout `loadRecentChat` 주입).
- 다른 시안 `/p/<otherPublicId>`를 열면 채팅이 **비어 있음**(시안 단위 격리, `proposal_id` 스코프).

- [ ] **Step 7: 게이트 확인**

- 비번 시안을 unlock하지 않은 상태에서 `POST /api/p/<publicId>/chat`를 직접 호출(예: 콘솔 `fetch`)하면 **403**. (정상 흐름에선 게이트 통과 후에만 패널이 마운트됨.)

- [ ] **Step 8: 완료 처리**

수동 검증을 통과하면 `superpowers:finishing-a-development-branch`로 master ff-merge 여부를 결정한다(스펙 §9: 완료 후 master ff-merge).

---

## Self-Review

**1. 스펙 커버리지(§5 중 채팅 부분):**
- 채팅 시안 단위 1방, 저장+실시간 → Task 2(테이블)·4(저장)·5(broadcast)·6(UI)·7(배선). ✅
- BFF + view-access 재검증 → Task 4(`resolveViewerGate` 게이트, 403). ✅
- 초기 채팅 서버 1차 로드 후 셸 주입 → Task 3·7. ✅
- 본문 ≤2000 검증 → Task 1(`validateChatBody`)·4. ✅
- RLS force deny 백스톱 → Task 2(canonical SQL). ✅
- 핀 코멘트 → **범위 외(Stage 2b 후속 plan)**, 상단 스코프 결정에 명시. ✅
- `GET /chat`·`view-access.ts` 미구현 → 상단 "의도적 차이"에 근거 명시. ✅

**2. 플레이스홀더 스캔:** 모든 코드 스텝에 실제 코드/명령/기대출력 포함. TBD/“적절히 처리” 없음. ✅

**3. 타입 일관성:**
- `ChatMessageDTO`(types.ts) — load-chat·route·provider·shell·panel 전부 동일 import. ✅
- `sendChat(message: ChatMessageDTO)` — provider 정의 ↔ panel 호출 시그니처 일치. ✅
- `chat_messages` 컬럼(author_name/author_color/body/created_at) ↔ 스키마 필드(authorName/authorColor/body/createdAt) ↔ DTO 필드명 일치. ✅
- broadcast event 문자열 `"chat"` — 송신(`sendChat`)·수신(`ch.on`) 일치. ✅
- `RealtimeShell` prop `initialChat` — layout 전달 ↔ shell 시그니처 ↔ provider 전달 일치. ✅
