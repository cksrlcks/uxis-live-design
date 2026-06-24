# 피그마 플러그인 구글 로그인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 피그마 플러그인에서 구글 OAuth로 로그인할 수 있게, 외부 브라우저 로그인 → 서버 임시저장 → 플러그인 폴링 회수(페어링) 흐름을 구현한다.

**Architecture:** 플러그인이 `readKey`(랜덤)를 만들고 `writeKey = SHA-256(readKey)`를 외부 브라우저 OAuth URL에 실어 연다. 웹 서버가 구글 콜백에서 토큰을 `writeKey`로 5분 TTL·1회용으로 DB에 저장하고, 플러그인은 `readKey`로 폴링해 회수한다. 해시는 역산 불가하므로 URL에 노출되는 writeKey로는 토큰을 가로챌 수 없다.

**Tech Stack:** Next.js 16(이 레포는 `middleware.ts`가 아니라 루트 `proxy.ts`를 씀), Supabase(@supabase/ssr PKCE), Drizzle ORM(postgres), React 18(플러그인 UI, Vite), Vitest(node env).

## Global Constraints

- Node ≥ 22 (package.json engines). `db:migrate`/`db:generate`는 이 버전에서 실행.
- "이건 네가 아는 Next.js가 아니다" — Next 특화 코드 작성 전 `node_modules/next/dist/docs/` 관련 문서 확인(AGENTS.md). 미들웨어는 루트 `proxy.ts`.
- `/api/plugin/*` 표면은 [`proxy.ts`](../../../proxy.ts)가 CORS `*` + CSRF 제외를 자동 처리 → 신규 OAuth 라우트는 모두 이 prefix 아래 둔다(추가 CORS 코드 불필요).
- 주석은 한국어로, 기존 파일 톤에 맞춘다. 사용자 응답도 한국어.
- 플러그인 서버 주소는 운영 `https://uxis-cova.vercel.app` ([`figma-plugin/src/ui/config.ts`](../../../figma-plugin/src/ui/config.ts)).
- 토큰 임시저장은 5분 TTL + 최초 폴링 시 즉시 삭제(1회용). 키 컬럼은 `writeKey`(= sha256(readKey))만 저장.
- 서버 sha256과 플러그인 Web Crypto sha256은 **동일 입력에 동일 hex**를 내야 한다(교차 호환). 둘 다 동일 테스트 벡터로 검증.

---

## File Structure

**백엔드(웹)**
- `drizzle/schema.ts` (수정) — `pluginOauthPairings` 테이블 정의.
- `drizzle/migrations/00NN_*.sql` (생성) — `db:generate` 산출물.
- `src/features/auth/lib/oauth-pairing.ts` (생성) — `pairingKey()` 순수 해시 헬퍼(server-only 아님 → 테스트 용이).
- `src/features/auth/api/plugin-auth.server.ts` (수정) — `startPluginGoogleOAuth`, `completePluginGoogleOAuth`, `pluginOAuthPoll`.
- `app/api/plugin/auth/oauth/google/route.ts` (생성) — 동의 화면으로 리다이렉트.
- `app/api/plugin/auth/oauth/callback/route.ts` (생성) — code 교환 → 저장 → 완료 HTML.
- `app/api/plugin/auth/oauth/poll/route.ts` (생성) — readKey 폴링.

**플러그인 UI**
- `figma-plugin/src/ui/lib/oauth.ts` (생성) — `randomKey()`, `sha256Hex()`.
- `figma-plugin/src/ui/lib/api.ts` (수정) — `oauthAuthorizeUrl()`, `pollOAuth()`, 폴링 응답 타입.
- `figma-plugin/src/ui/lib/errors.ts` (수정) — `OAUTH_TIMEOUT`, `OAUTH_FAILED`.
- `figma-plugin/src/ui/hooks/useOAuthLogin.ts` (생성) — 페어링 시작·폴링 루프.
- `figma-plugin/src/ui/components/Login.tsx` (수정) — 구글 버튼 + 구분선 + 대기/취소 UI.
- `figma-plugin/src/ui/styles.css` (수정) — `.divider`, `button.google`.
- `figma-plugin/src/ui/App.tsx` (수정) — 훅 연결.

**테스트(자동)**
- `tests/features/auth/oauth-pairing.test.ts` (생성)
- `figma-plugin/src/ui/lib/oauth.test.ts` (생성)
- `figma-plugin/src/ui/lib/api.test.ts` (수정 — `oauthAuthorizeUrl` 추가)

> 자동 테스트는 **순수 로직(해시·URL 빌더)** 에만 둔다. Supabase/DB 통합(서버 함수·라우트)과 React/타이머 훅·UI는 이 레포 관례대로 typecheck/build + 수동 E2E로 검증한다.

---

### Task 1: DB — `plugin_oauth_pairings` 테이블

**Files:**
- Modify: `drizzle/schema.ts` (끝에 추가)
- Create: `drizzle/migrations/00NN_*.sql` (db:generate 산출 — 파일명 자동)

**Interfaces:**
- Produces: `pluginOauthPairings` 테이블, 타입 `PluginOauthPairing`. 컬럼 `key: text PK`, `payload: jsonb`, `expiresAt: timestamptz`, `createdAt: timestamptz`.

- [ ] **Step 1: 스키마에 테이블 추가**

`drizzle/schema.ts` 맨 끝에 추가(상단 import에 `jsonb`, `text`, `timestamp`, `pgTable`는 이미 있음):

```ts
// 플러그인 구글 OAuth 페어링 — 외부 브라우저 로그인 결과(토큰)를 플러그인이 폴링으로 회수할 때까지
// 잠깐 보관하는 1회용 저장소. key = sha256(readKey)(= writeKey). 최초 폴링 시 삭제, TTL 5분.
export const pluginOauthPairings = pgTable("plugin_oauth_pairings", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").notNull(), // { accessToken, refreshToken, expiresAt, user }
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PluginOauthPairing = typeof pluginOauthPairings.$inferSelect;
```

- [ ] **Step 2: 마이그레이션 생성**

Run: `npm run db:generate`
Expected: `drizzle/migrations/00NN_<random>.sql` 와 `meta/00NN_snapshot.json`, `_journal.json` 갱신. 새 SQL은 대략:

```sql
CREATE TABLE "plugin_oauth_pairings" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

(생성된 SQL이 위와 일치하는지 눈으로 확인. 다른 테이블 변경이 섞여 있으면 스키마를 잘못 건드린 것 — 되돌릴 것.)

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 통과(에러 0). 기존 무관 에러가 있으면 [repo-verification-gotchas] 참고.

- [ ] **Step 4: 커밋**

```bash
git add drizzle/schema.ts drizzle/migrations
git commit -m "feat(db): plugin_oauth_pairings 테이블(구글 로그인 페어링 임시저장)"
```

---

### Task 2: 서버 — 페어링 키 해시 헬퍼 (순수, TDD)

**Files:**
- Create: `src/features/auth/lib/oauth-pairing.ts`
- Test: `tests/features/auth/oauth-pairing.test.ts`

**Interfaces:**
- Produces: `pairingKey(readKey: string): string` — readKey의 SHA-256 hex 소문자. (= 플러그인 writeKey와 동일 값)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/features/auth/oauth-pairing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pairingKey } from "@/features/auth/lib/oauth-pairing";

describe("pairingKey", () => {
  it("'abc'의 SHA-256 hex (NIST 벡터)", () => {
    expect(pairingKey("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it("64자 소문자 hex", () => {
    expect(pairingKey("any-read-key")).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/features/auth/oauth-pairing.test.ts`
Expected: FAIL — "Cannot find module '@/features/auth/lib/oauth-pairing'".

- [ ] **Step 3: 구현**

`src/features/auth/lib/oauth-pairing.ts`:

```ts
import { createHash } from "node:crypto";

// readKey → SHA-256 hex. 플러그인이 만든 writeKey(= 브라우저 URL의 ?k=)와 동일 값이 되어
// 콜백이 저장한 행을 폴링이 같은 키로 찾는다. (Web Crypto / node:crypto 결과가 같아야 함)
export function pairingKey(readKey: string): string {
  return createHash("sha256").update(readKey).digest("hex");
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/features/auth/oauth-pairing.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 5: 커밋**

```bash
git add src/features/auth/lib/oauth-pairing.ts tests/features/auth/oauth-pairing.test.ts
git commit -m "feat(auth): pairingKey 해시 헬퍼 + 테스트"
```

---

### Task 3: 서버 — 플러그인 OAuth 함수 3종

**Files:**
- Modify: `src/features/auth/api/plugin-auth.server.ts`

**Interfaces:**
- Consumes: `pairingKey` (Task 2), `pluginOauthPairings` (Task 1), 기존 `tokens()`, `profiles`, `db`.
- Produces:
  - `startPluginGoogleOAuth(writeKey: string, origin: string): Promise<string>` — 구글 동의 URL.
  - `completePluginGoogleOAuth(writeKey: string, code: string): Promise<void>` — 교환·저장.
  - `pluginOAuthPoll(input: unknown): Promise<OAuthPayload | { status: "pending" }>` — `{ readKey }` 받아 회수.
  - 타입 `OAuthPayload = { accessToken: string; refreshToken: string; expiresAt: unknown; user: {...} }`.

- [ ] **Step 1: import 추가**

`src/features/auth/api/plugin-auth.server.ts` 상단 import 블록에 추가/수정:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { eq, lt } from "drizzle-orm";
import { profiles, pluginOauthPairings } from "@drizzle/schema";
import { pairingKey } from "../lib/oauth-pairing";
```

(기존 `import { eq } from "drizzle-orm";` 는 위 `eq, lt`로 통합. 기존 `import { profiles } from "@drizzle/schema";` 도 위로 통합. 중복 import 남기지 말 것.)

- [ ] **Step 2: 시작 함수 추가**

기존 `pluginRefresh` 아래, `tokens()` 위에 추가:

```ts
const PAIRING_TTL_MS = 5 * 60 * 1000;

// 구글 동의 화면 URL 생성. PKCE 검증 쿠키는 createSupabaseServer 류 쿠키 어댑터가 응답에 심는다.
// 착지점은 플러그인 전용 콜백(?k=writeKey). signInWithOAuth는 세션 쿠키를 심지 않으므로
// 여기선 일반 서버 클라이언트로 충분하다.
export async function startPluginGoogleOAuth(writeKey: string, origin: string): Promise<string> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  );
  const redirectTo = `${origin}/api/plugin/auth/oauth/callback?k=${encodeURIComponent(writeKey)}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) throw new Error("OAUTH_INIT_FAILED");
  return data.url;
}
```

- [ ] **Step 3: 콜백(교환·저장) 함수 추가**

이어서 추가:

```ts
// 구글 콜백 처리: code→세션 교환 → 프로필 조회 → 토큰 payload를 writeKey로 임시 저장(1회용).
// 교환 클라이언트는 PKCE 검증 쿠키는 읽되(getAll) 세션 쿠키는 안 심는다(setAll no-op) —
// 외부 브라우저에 웹 세션을 남기지 않아 플러그인의 쿠키리스 철학을 유지한다.
export async function completePluginGoogleOAuth(writeKey: string, code: string): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // 세션 쿠키 미설치
      },
    },
  );
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user) throw new Error("OAUTH_FAILED");

  const rows = await db.select().from(profiles).where(eq(profiles.id, data.user.id)).limit(1);
  const profile = rows[0];
  const payload = {
    ...tokens(data.session),
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
      name: profile?.displayName ?? null,
      role: profile?.role ?? null,
    },
  };
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  await db
    .insert(pluginOauthPairings)
    .values({ key: writeKey, payload, expiresAt })
    .onConflictDoUpdate({ target: pluginOauthPairings.key, set: { payload, expiresAt } });
}
```

- [ ] **Step 4: 폴링 함수 추가**

이어서 추가:

```ts
const pollSchema = z.object({ readKey: z.string().min(1) });

// readKey → sha256(=writeKey)로 행 조회. 있으면 토큰 반환 + 즉시 삭제(1회용), 없으면 pending.
// 매 호출 시 만료 행을 베스트에포트로 정리한다.
export async function pluginOAuthPoll(input: unknown) {
  const { readKey } = pollSchema.parse(input);
  const key = pairingKey(readKey);

  await db.delete(pluginOauthPairings).where(lt(pluginOauthPairings.expiresAt, new Date()));

  const rows = await db
    .select()
    .from(pluginOauthPairings)
    .where(eq(pluginOauthPairings.key, key))
    .limit(1);
  const row = rows[0];
  if (!row) return { status: "pending" as const };

  await db.delete(pluginOauthPairings).where(eq(pluginOauthPairings.key, key));
  return row.payload as {
    accessToken: string;
    refreshToken: string;
    expiresAt: unknown;
    user: { id: string; email: string | null; name: string | null; role: string | null };
  };
}
```

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 통과. (`createServerClient`, `cookies`, `lt`, `pluginOauthPairings`, `pairingKey` 모두 해석되어야 함.)

- [ ] **Step 6: 커밋**

```bash
git add src/features/auth/api/plugin-auth.server.ts
git commit -m "feat(auth): 플러그인 구글 OAuth 시작/콜백/폴링 서버 함수"
```

---

### Task 4: 서버 — OAuth 라우트 3종

**Files:**
- Create: `app/api/plugin/auth/oauth/google/route.ts`
- Create: `app/api/plugin/auth/oauth/callback/route.ts`
- Create: `app/api/plugin/auth/oauth/poll/route.ts`

**Interfaces:**
- Consumes: Task 3 함수들, `toErrorResponse`.
- Produces: `GET /api/plugin/auth/oauth/google?k=`, `GET /api/plugin/auth/oauth/callback?k=&code=`, `POST /api/plugin/auth/oauth/poll`.

- [ ] **Step 1: google 라우트**

`app/api/plugin/auth/oauth/google/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { startPluginGoogleOAuth } from "@/features/auth/api/plugin-auth.server";
import { errorHtml } from "../html";

// 플러그인 구글 로그인 시작점(외부 브라우저가 연다). writeKey(?k=)를 콜백 redirectTo에 실어
// 동의 화면으로 보낸다. origin은 프록시 뒤에서도 맞도록 host 헤더 우선으로 만든다.
export async function GET(req: NextRequest) {
  const k = new URL(req.url).searchParams.get("k");
  if (!k) return html(errorHtml("잘못된 요청입니다."), 400);

  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : req.nextUrl.origin;

  try {
    return NextResponse.redirect(await startPluginGoogleOAuth(k, origin));
  } catch {
    return html(errorHtml("구글 로그인을 시작할 수 없습니다."), 500);
  }
}

function html(body: string, status: number) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
```

- [ ] **Step 2: 완료/에러 HTML 공용 모듈**

`app/api/plugin/auth/oauth/html.ts`:

```ts
// 외부 브라우저에서 사람이 보는 안내 페이지. 플러그인은 폴링으로 결과를 받으므로
// 이 페이지는 안내만 한다(자동 닫기는 브라우저 정책상 보장되지 않음).
function page(title: string, message: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>body{font:16px/1.6 -apple-system,BlinkMacSystemFont,system-ui,"Malgun Gothic",sans-serif;
display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;background:#fff;color:#080808}
.box{max-width:360px;padding:32px;text-align:center}
h1{font-size:20px;margin:0 0 8px}p{color:#5a5a5a;margin:0}</style></head>
<body><div class="box"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

export function successHtml(): string {
  return page("로그인 완료", "피그마로 돌아가면 자동으로 로그인됩니다. 이 창은 닫아도 됩니다.");
}

export function errorHtml(message: string): string {
  return page("로그인 실패", message);
}
```

- [ ] **Step 3: callback 라우트**

`app/api/plugin/auth/oauth/callback/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { completePluginGoogleOAuth } from "@/features/auth/api/plugin-auth.server";
import { errorHtml, successHtml } from "../html";

// 구글 OAuth 착지점. code를 세션으로 교환해 토큰을 writeKey로 임시 저장한 뒤 완료 안내를 띄운다.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const k = url.searchParams.get("k");
  const code = url.searchParams.get("code");
  if (!k || !code) return html(errorHtml("인증 정보가 없습니다."), 400);

  try {
    await completePluginGoogleOAuth(k, code);
    return html(successHtml(), 200);
  } catch {
    return html(errorHtml("로그인 처리에 실패했습니다. 다시 시도해주세요."), 500);
  }
}

function html(body: string, status: number) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
```

- [ ] **Step 4: poll 라우트**

`app/api/plugin/auth/oauth/poll/route.ts`:

```ts
import { NextRequest } from "next/server";
import { pluginOAuthPoll } from "@/features/auth/api/plugin-auth.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 플러그인이 readKey로 폴링. 준비되면 토큰(로그인 응답과 동일 shape), 아니면 { status: 'pending' }.
export async function POST(req: NextRequest) {
  try {
    return Response.json(await pluginOAuthPoll(await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 5: 빌드로 라우트 등록 확인**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 통과. (라우트 4개 파일 모두 해석.)

- [ ] **Step 6: poll pending 동작 수동 확인(서버 기동 시)**

`npm run dev` 후 별도 셸:
Run: `curl -s -X POST http://localhost:3000/api/plugin/auth/oauth/poll -H "Content-Type: application/json" -d '{"readKey":"nonexistent"}'`
Expected: `{"status":"pending"}` (DB에 행 없음). 빈 body나 readKey 누락 시 `{"error":"VALIDATION_ERROR",...}` 400.

> dev 서버를 띄울 수 없으면 이 스텝은 Task 9 수동 E2E로 미룬다.

- [ ] **Step 7: 커밋**

```bash
git add app/api/plugin/auth/oauth
git commit -m "feat(api): 플러그인 구글 OAuth 라우트(google/callback/poll)"
```

---

### Task 5: 플러그인 — OAuth 암호 헬퍼 (TDD)

**Files:**
- Create: `figma-plugin/src/ui/lib/oauth.ts`
- Test: `figma-plugin/src/ui/lib/oauth.test.ts`

**Interfaces:**
- Produces: `randomKey(): string` (64자 hex), `sha256Hex(input: string): Promise<string>` (64자 hex 소문자).

- [ ] **Step 1: 실패하는 테스트 작성**

`figma-plugin/src/ui/lib/oauth.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { randomKey, sha256Hex } from './oauth';

describe('sha256Hex', () => {
  it("'abc' NIST 벡터 — 서버 pairingKey와 동일해야 함", async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('randomKey', () => {
  it('64자 hex', () => {
    expect(randomKey()).toMatch(/^[0-9a-f]{64}$/);
  });
  it('호출마다 다름', () => {
    expect(randomKey()).not.toBe(randomKey());
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd figma-plugin && npx vitest run src/ui/lib/oauth.test.ts`
Expected: FAIL — "Cannot find module './oauth'".

- [ ] **Step 3: 구현**

`figma-plugin/src/ui/lib/oauth.ts`:

```ts
// 플러그인용 페어링 키. readKey(랜덤)는 플러그인↔폴링에서만 쓰고, 외부 브라우저 URL에는
// writeKey = sha256Hex(readKey)만 노출한다. 해시는 역산 불가 → URL 유출돼도 토큰 회수 불가.
// Figma 데스크톱(Chromium)/Node 22 모두 전역 Web Crypto를 제공한다.

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomKey(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return toHex(a);
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd figma-plugin && npx vitest run src/ui/lib/oauth.test.ts`
Expected: PASS (3 passed). 서버 `pairingKey('abc')`와 동일한 hex가 나오는지(같은 벡터) 확인.

- [ ] **Step 5: 커밋**

```bash
git add figma-plugin/src/ui/lib/oauth.ts figma-plugin/src/ui/lib/oauth.test.ts
git commit -m "feat(figma-plugin): OAuth 페어링 키 헬퍼(randomKey/sha256Hex) + 테스트"
```

---

### Task 6: 플러그인 — api.pollOAuth + authorize URL (TDD path builder)

**Files:**
- Modify: `figma-plugin/src/ui/lib/api.ts`
- Modify: `figma-plugin/src/ui/lib/api.test.ts`

**Interfaces:**
- Consumes: 기존 `joinUrl`, `request`, `LoginResponse`, `User`.
- Produces:
  - `oauthAuthorizeUrl(baseUrl: string, writeKey: string): string`.
  - 타입 `OAuthPollResponse = LoginResponse | { status: 'pending' }`.
  - ApiClient에 `pollOAuth(readKey: string): Promise<OAuthPollResponse>`.

- [ ] **Step 1: 실패하는 테스트 추가**

`figma-plugin/src/ui/lib/api.test.ts`의 import에 `oauthAuthorizeUrl` 추가하고 describe 추가:

```ts
import { variantsPath, versionsPath, pagesPath, oauthAuthorizeUrl } from './api';
```

```ts
describe('oauthAuthorizeUrl', () => {
  it('writeKey를 k 쿼리로, base 끝 슬래시 제거', () => {
    expect(oauthAuthorizeUrl('https://x.dev/', 'abc')).toBe(
      'https://x.dev/api/plugin/auth/oauth/google?k=abc',
    );
  });
  it('writeKey를 URL 인코딩', () => {
    expect(oauthAuthorizeUrl('https://x.dev', 'a/b')).toBe(
      'https://x.dev/api/plugin/auth/oauth/google?k=a%2Fb',
    );
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd figma-plugin && npx vitest run src/ui/lib/api.test.ts`
Expected: FAIL — `oauthAuthorizeUrl` is not a function / not exported.

- [ ] **Step 3: api.ts 구현**

`figma-plugin/src/ui/lib/api.ts`의 `joinUrl` 아래에 추가:

```ts
// 외부 브라우저로 열 구글 로그인 시작 URL. writeKey만 노출한다(readKey는 폴링에서만 사용).
export function oauthAuthorizeUrl(baseUrl: string, writeKey: string): string {
  return joinUrl(baseUrl, '/api/plugin/auth/oauth/google?k=' + encodeURIComponent(writeKey));
}
```

`LoginResponse` 타입 아래에 추가:

```ts
export type OAuthPollResponse = LoginResponse | { status: 'pending' };
```

`createApiClient` 반환 객체의 `login:` 항목 아래에 추가:

```ts
    pollOAuth: (readKey: string) =>
      request<OAuthPollResponse>('/api/plugin/auth/oauth/poll', {
        method: 'POST',
        body: JSON.stringify({ readKey }),
      }),
```

- [ ] **Step 4: 통과 확인**

Run: `cd figma-plugin && npx vitest run src/ui/lib/api.test.ts`
Expected: PASS (기존 3 + 신규 2 = 5 passed).

- [ ] **Step 5: 커밋**

```bash
git add figma-plugin/src/ui/lib/api.ts figma-plugin/src/ui/lib/api.test.ts
git commit -m "feat(figma-plugin): api.pollOAuth + oauthAuthorizeUrl"
```

---

### Task 7: 플러그인 — useOAuthLogin 훅

**Files:**
- Create: `figma-plugin/src/ui/hooks/useOAuthLogin.ts`

**Interfaces:**
- Consumes: `ApiClient.pollOAuth` (Task 6), `randomKey`/`sha256Hex` (Task 5), `oauthAuthorizeUrl` (Task 6), `API_BASE`, `SessionConfig`.
- Produces: `useOAuthLogin(opts)` → `{ busy: boolean; error: string; start(): void; cancel(): void }`. `opts = { api, openUrl, onSuccess }`.

- [ ] **Step 1: 훅 구현**

`figma-plugin/src/ui/hooks/useOAuthLogin.ts`:

```ts
import { useCallback, useRef, useState } from 'react';
import { API_BASE } from '../config';
import { oauthAuthorizeUrl, type ApiClient } from '../lib/api';
import { randomKey, sha256Hex } from '../lib/oauth';
import type { SessionConfig } from './useSession';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

type Opts = {
  api: ApiClient;
  openUrl: (url: string) => void;
  onSuccess: (s: SessionConfig) => void;
};

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// 구글 로그인 페어링: readKey 생성 → writeKey로 외부 브라우저 열기 → readKey로 폴링.
// 타임아웃/취소 가능. 성공 시 onSuccess로 세션 전달.
export function useOAuthLogin(opts: Opts) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setBusy(false);
  }, []);

  const start = useCallback(async () => {
    setError('');
    setBusy(true);
    cancelRef.current = false;
    try {
      const readKey = randomKey();
      const writeKey = await sha256Hex(readKey);
      optsRef.current.openUrl(oauthAuthorizeUrl(API_BASE, writeKey));

      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (!cancelRef.current && Date.now() < deadline) {
        await delay(POLL_INTERVAL_MS);
        if (cancelRef.current) return;
        let res;
        try {
          res = await optsRef.current.api.pollOAuth(readKey);
        } catch {
          continue; // 일시적 네트워크/서버 오류는 무시하고 계속 폴링
        }
        if ('status' in res) continue; // pending
        optsRef.current.onSuccess({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          expiresAt: res.expiresAt,
          user: res.user,
        });
        setBusy(false);
        return;
      }
      if (!cancelRef.current) setError('OAUTH_TIMEOUT');
    } catch {
      setError('OAUTH_FAILED');
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, start, cancel };
}
```

- [ ] **Step 2: 타입체크**

Run: `cd figma-plugin && npx tsc --noEmit`
Expected: 통과. (`ApiClient`, `SessionConfig`, `oauthAuthorizeUrl`, `randomKey`, `sha256Hex` 해석.)

- [ ] **Step 3: 커밋**

```bash
git add figma-plugin/src/ui/hooks/useOAuthLogin.ts
git commit -m "feat(figma-plugin): useOAuthLogin 페어링 폴링 훅"
```

---

### Task 8: 플러그인 — Login 버튼 + 스타일 + App 연결 + 에러 메시지

**Files:**
- Modify: `figma-plugin/src/ui/lib/errors.ts`
- Modify: `figma-plugin/src/ui/components/Login.tsx`
- Modify: `figma-plugin/src/ui/styles.css`
- Modify: `figma-plugin/src/ui/App.tsx`

**Interfaces:**
- Consumes: `useOAuthLogin` (Task 7), `humanize` (errors).
- Produces: 구글 로그인 버튼이 동작하는 로그인 화면.

- [ ] **Step 1: 에러 메시지 추가**

`figma-plugin/src/ui/lib/errors.ts`의 `MSG`에 추가:

```ts
  OAUTH_TIMEOUT: '구글 로그인 시간이 초과되었습니다. 다시 시도하세요.',
  OAUTH_FAILED: '구글 로그인에 실패했습니다. 다시 시도하세요.',
```

- [ ] **Step 2: Login.tsx에 구글 버튼 추가**

`figma-plugin/src/ui/components/Login.tsx` 전체를 아래로 교체(이메일 로그인 부분은 유지, props 확장):

```tsx
import { useState } from 'react';
import { CovaLogo } from './CovaLogo';

export function Login({
  busy,
  errorText,
  onSubmit,
  onSignup,
  oauthBusy,
  oauthError,
  onGoogle,
  onCancelOauth,
}: {
  busy: boolean;
  errorText: string;
  onSubmit: (email: string, password: string) => void;
  onSignup: () => void;
  oauthBusy: boolean;
  oauthError: string;
  onGoogle: () => void;
  onCancelOauth: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => onSubmit(email.trim(), password);

  return (
    <section id="login">
      <div className="loginbody">
        <CovaLogo className="logo login-logo" width={106} height={26} />
        <h1 className="login-title">로그인</h1>
        <p className="login-sub">가입하신 이메일로 로그인해주세요</p>

        <label htmlFor="email">이메일</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="6자 이상"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />

        <button id="loginBtn" type="button" disabled={busy || oauthBusy} onClick={submit}>
          {busy ? '로그인 중…' : '로그인'}
        </button>

        <div className="divider">또는</div>

        {oauthBusy ? (
          <button type="button" className="google" disabled>
            브라우저에서 로그인 완료 대기 중…
          </button>
        ) : (
          <button type="button" className="google" disabled={busy} onClick={onGoogle}>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            Google로 계속하기
          </button>
        )}

        {oauthBusy && (
          <div className="signup">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onCancelOauth();
              }}
            >
              취소
            </a>
          </div>
        )}

        <div className="err" id="loginErr">
          {errorText || oauthError}
        </div>

        <div className="signup">
          계정이 없으신가요?{' '}
          <a
            id="signupLink"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onSignup();
            }}
          >
            회원가입
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: styles.css에 divider/google 스타일 추가**

`figma-plugin/src/ui/styles.css`의 `/* ---- login ---- */` 블록 끝(`.signup a:hover` 다음 줄)에 추가:

```css
      .divider { display: flex; align-items: center; gap: 12px; margin-top: 22px; color: var(--muted-foreground); font-size: 12px; }
      .divider::before, .divider::after { content: ""; height: 1px; flex: 1; background: var(--border); }
      .loginbody button.google { margin-top: 12px; gap: 10px; background: var(--background); color: var(--foreground); border: 1px solid var(--border); font-weight: 500; }
      .loginbody button.google:hover:not(:disabled) { background: var(--muted); }
      .loginbody button.google svg { width: 18px; height: 18px; flex: none; }
```

- [ ] **Step 4: App.tsx에서 훅 연결**

`figma-plugin/src/ui/App.tsx` 수정:

import 추가(다른 hook import 근처):

```tsx
import { useOAuthLogin } from './hooks/useOAuthLogin';
import { humanize } from './lib/errors';
```

(`humanize`는 이미 import되어 있으면 중복 추가하지 말 것.)

`api` useMemo 선언 다음 줄에 훅 추가:

```tsx
  const oauth = useOAuthLogin({ api, openUrl: bridge.openUrl, onSuccess: session.setSession });
```

`if (!isAuthed)` 블록의 `<Login .../>`를 아래로 교체:

```tsx
  if (!isAuthed) {
    return (
      <>
        <CovaLogoSymbol />
        <Login
          busy={loginBusy}
          errorText={loginErr}
          onSubmit={doLogin}
          onSignup={() => openUrl(API_BASE.replace(/\/+$/, '') + '/signup')}
          oauthBusy={oauth.busy}
          oauthError={oauth.error ? humanize(oauth.error) : ''}
          onGoogle={oauth.start}
          onCancelOauth={oauth.cancel}
        />
      </>
    );
  }
```

- [ ] **Step 5: 타입체크 + 빌드**

Run: `cd figma-plugin && npx tsc --noEmit && npm run build`
Expected: 타입 통과 + `dist/` 산출(빌드 성공).

- [ ] **Step 6: 플러그인 테스트 전체**

Run: `cd figma-plugin && npm test`
Expected: 기존 + 신규 테스트 모두 PASS.

- [ ] **Step 7: 커밋**

```bash
git add figma-plugin/src/ui/components/Login.tsx figma-plugin/src/ui/styles.css figma-plugin/src/ui/App.tsx figma-plugin/src/ui/lib/errors.ts
git commit -m "feat(figma-plugin): 로그인 화면에 구글 로그인 버튼/대기 UI"
```

---

### Task 9: 검증 + 수동 운영 작업

**Files:** 없음(설정·검증)

- [ ] **Step 1: 전체 테스트(웹 + 플러그인)**

Run: `npm test`
Then: `cd figma-plugin && npm test`
Expected: 둘 다 PASS(기존 무관 실패는 [repo-verification-gotchas] 대조).

- [ ] **Step 2: 웹 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 통과.

- [ ] **Step 3: Supabase 대시보드 리다이렉트 URL 등록(필수, 수동)**

Authentication → URL Configuration → Redirect URLs에 추가:
- `https://uxis-cova.vercel.app/api/plugin/auth/oauth/callback`
- (로컬) `http://localhost:3000/api/plugin/auth/oauth/callback`

미등록 시 구글 리다이렉트가 거부된다. 구글 provider/Secret 자체는 웹 구글 로그인에서 이미 설정됨.

- [ ] **Step 4: 마이그레이션 적용(운영/대상 DB, 수동, Node ≥22)**

Run: `npm run db:migrate`
Expected: `plugin_oauth_pairings` 생성. (적용 환경/권한은 [phase1b-db-reconciliation] 참고.)

- [ ] **Step 5: 수동 E2E**

플러그인 빌드본을 피그마에 로드 → 로그인 화면에서 "Google로 계속하기" → 외부 브라우저에서 구글 로그인 → "로그인 완료" 페이지 → 피그마로 복귀하면 자동 로그인 → 시안 목록/업로드 동작 확인. (구글로만 가입한 계정으로도 로그인되는지 확인.)

- [ ] **Step 6: 최종 커밋(없으면 생략)**

변경이 더 있으면 커밋. 없으면 이 태스크는 검증만.

---

## Self-Review

**Spec coverage:**
- 폴링 페어링 흐름 → Task 3·4(서버)·7(폴링 루프). ✓
- 해시 read/write 분리 보안 → Task 2·5(동일 벡터 교차검증)·3(키 저장). ✓
- DB 임시저장 5분 TTL·1회용 → Task 1(테이블)·3(저장/삭제). ✓
- 쿠키리스 콜백(세션 쿠키 미설치) → Task 3 Step 3 setAll no-op. ✓
- 플러그인 UI 버튼/구분선/대기·취소 → Task 8. ✓
- pending 계정 허용(기존 정책) → role을 그대로 payload에 담아 반환, UI 경고는 기존 코드 유지. ✓
- 수동 Supabase 설정 + 마이그레이션 적용 → Task 9. ✓

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "TBD/적절히 처리" 없음. ✓

**Type consistency:** `pairingKey`(서버)·`sha256Hex`(플러그인) 동일 벡터. `OAuthPollResponse = LoginResponse | {status:'pending'}` → 훅에서 `'status' in res`로 분기. `startPluginGoogleOAuth/completePluginGoogleOAuth/pluginOAuthPoll` 시그니처가 라우트 호출과 일치. `useOAuthLogin` 반환 `{busy,error,start,cancel}`이 App/Login props와 일치(`oauthBusy/oauthError/onGoogle/onCancelOauth`). ✓
