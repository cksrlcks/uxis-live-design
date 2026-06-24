# 피그마 플러그인 구글 로그인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 피그마 플러그인 첫 화면을 "로그인하기" 버튼 하나로 바꾸고, 누르면 외부 브라우저로 **기존 웹 로그인 페이지**(이메일+구글)를 열어 로그인한 뒤 플러그인이 폴링으로 세션을 회수하게 한다.

**Architecture:** 플러그인이 uuid(페어링 키)를 만들어 `${WEB}/plugin-auth?k=<key>`를 외부 브라우저로 연다. 그 페이지는 미로그인 시 기존 `/login?returnTo=...`로 보내고, 로그인되면 쿠키 세션의 토큰을 key로 5분 TTL·1회용으로 DB에 저장한다. 플러그인은 `POST /api/plugin/auth/poll`을 key로 폴링해 토큰을 회수한다.

**Tech Stack:** Next.js 16(미들웨어는 루트 `proxy.ts`), Supabase(@supabase/ssr 쿠키 세션), Drizzle ORM(postgres), React 18(플러그인 UI, Vite), Vitest(node env).

## Global Constraints

- Node ≥ 22 (package.json engines). `db:generate`/`db:migrate`는 이 버전에서 실행.
- "이건 네가 아는 Next.js가 아니다" — Next 특화 코드 작성 전 `node_modules/next/dist/docs/` 확인(AGENTS.md). 미들웨어는 루트 `proxy.ts`.
- `/api/plugin/*` 표면은 [`proxy.ts`](../../../proxy.ts)가 CORS `*` + CSRF 제외를 자동 처리 → poll 라우트는 이 prefix 아래 둔다(추가 CORS 코드 불필요).
- 주석은 한국어로, 기존 파일 톤에 맞춘다. 사용자 응답도 한국어.
- 플러그인 서버 주소는 운영 `https://uxis-cova.vercel.app` ([`figma-plugin/src/ui/config.ts`](../../../figma-plugin/src/ui/config.ts)).
- 토큰 임시저장은 5분 TTL + 최초 폴링 시 즉시 삭제(1회용).
- 웹 로그인 페이지 재사용: 브라우저는 `/plugin-auth?k=<key>`만 연다(구글 OAuth 직접 호출 라우트는 만들지 않는다). 로그인 후 복귀는 기존 `returnTo` 메커니즘에 의존.
- `isSafeInternalPath`는 `/plugin-auth?k=...`(슬래시 시작·`//`아님)를 허용함 — 확인됨.

---

## File Structure

**백엔드(웹)**
- `drizzle/schema.ts` (수정) — `pluginAuthPairings` 테이블.
- `drizzle/migrations/00NN_*.sql` (생성) — `db:generate` 산출물.
- `src/features/auth/api/plugin-auth.server.ts` (수정) — `storePluginPairing`, `pollPluginPairing` 추가; `pluginLogin` 제거.
- `app/api/plugin/auth/login/route.ts` (삭제) — 더 이상 안 씀.
- `app/api/plugin/auth/poll/route.ts` (생성) — 폴링.
- `app/plugin-auth/page.tsx` (생성) — 외부 브라우저 착지 페이지.

**플러그인 UI**
- `figma-plugin/src/ui/lib/api.ts` (수정) — `signInUrl()`, `pollPairing()` 추가; (Task 7에서) `login()` 제거.
- `figma-plugin/src/ui/lib/errors.ts` (수정) — `OAUTH_TIMEOUT`, `OAUTH_FAILED`.
- `figma-plugin/src/ui/hooks/usePairingLogin.ts` (생성) — uuid 생성·폴링 루프.
- `figma-plugin/src/ui/components/Login.tsx` (수정) — "로그인하기" 버튼 1개 + "로그인 중" 상태.
- `figma-plugin/src/ui/App.tsx` (수정) — 훅 연결, 이메일 로그인 핸들러 제거.

**테스트(자동)**
- `figma-plugin/src/ui/lib/api.test.ts` (수정 — `signInUrl`).

> 서버 함수·페이지·라우트는 Supabase/DB 통합이라 typecheck/build + 수동 E2E로 검증(레포 관례). 순수 로직(URL 빌더)만 단위 테스트한다.

---

### Task 1: DB — `plugin_auth_pairings` 테이블

**Files:**
- Modify: `drizzle/schema.ts` (끝에 추가)
- Create: `drizzle/migrations/00NN_*.sql` (db:generate 산출)

**Interfaces:**
- Produces: `pluginAuthPairings` 테이블, 타입 `PluginAuthPairing`. 컬럼 `key: text PK`, `payload: jsonb`, `expiresAt: timestamptz`, `createdAt: timestamptz`.

- [ ] **Step 1: 스키마에 테이블 추가**

`drizzle/schema.ts` 맨 끝에 추가(상단 import에 `pgTable`, `text`, `jsonb`, `timestamp`는 이미 있음 — 중복 추가 금지):

```ts
// 플러그인 로그인 페어링 — 외부 브라우저 로그인 결과(토큰)를 플러그인이 폴링으로 회수할 때까지
// 잠깐 보관하는 1회용 저장소. key = 플러그인이 만든 uuid. 최초 폴링 시 삭제, TTL 5분.
export const pluginAuthPairings = pgTable("plugin_auth_pairings", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").notNull(), // { accessToken, refreshToken, expiresAt, user }
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PluginAuthPairing = typeof pluginAuthPairings.$inferSelect;
```

- [ ] **Step 2: 마이그레이션 생성**

Run: `npm run db:generate`
Expected: `drizzle/migrations/00NN_<random>.sql` + `meta/` 갱신. 새 SQL은 대략:

```sql
CREATE TABLE "plugin_auth_pairings" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

(이 한 테이블만 생성돼야 함. 다른 테이블 변경이 섞이면 스키마를 잘못 건드린 것 — 되돌릴 것.)
환경 문제로 `db:generate`가 실패하면(예: `.env.local`/`DATABASE_URL` 미설정) BLOCKED로 정확한 출력과 함께 보고 — SQL/스냅샷을 손으로 쓰지 말 것.

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 통과(내 변경으로 인한 에러 0). 기존 무관 에러는 그대로 보고만.

- [ ] **Step 4: 커밋**

```bash
git add drizzle/schema.ts drizzle/migrations
git commit -m "feat(db): plugin_auth_pairings 테이블(로그인 페어링 임시저장)"
```

---

### Task 2: 서버 — 페어링 저장/폴링 + 구식 로그인 제거

**Files:**
- Modify: `src/features/auth/api/plugin-auth.server.ts`
- Delete: `app/api/plugin/auth/login/route.ts`

**Interfaces:**
- Consumes: `pluginAuthPairings`(Task 1), 기존 `tokens()`, `profiles`, `db`, `createSupabaseServer`.
- Produces:
  - `storePluginPairing(key: string): Promise<boolean>` — 쿠키 세션 읽어 payload를 key로 저장, 미로그인 시 false.
  - `pollPluginPairing(input: unknown): Promise<Payload | { status: "pending" }>` — `{ key }` 받아 회수.
- Removes: `pluginLogin`.

- [ ] **Step 1: import 정리**

`src/features/auth/api/plugin-auth.server.ts` 상단을 아래로 맞춘다(기존 `eq`만/`profiles`만 import를 통합, `createSupabaseServer` 추가, `loginSchema` import 제거):

```ts
import "server-only";
import { createClient, type Session } from "@supabase/supabase-js";
import { eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/db";
import { profiles, pluginAuthPairings } from "@drizzle/schema";
import { createSupabaseServer } from "@/shared/supabase/server";
```

- [ ] **Step 2: `pluginLogin` 제거, 저장/폴링 추가**

`pluginLogin` 함수 전체를 삭제하고, 그 자리에 아래를 넣는다(`authClient`, `pluginRefresh`, `tokens`는 그대로 유지):

```ts
const PAIRING_TTL_MS = 5 * 60 * 1000;
const pollSchema = z.object({ key: z.string().min(1) });

// 외부 브라우저에서 로그인된 쿠키 세션을 읽어, 플러그인이 폴링으로 회수할 토큰을 key로 임시 저장한다.
// getUser로 진위를 검증한 뒤 getSession으로 토큰을 얻는다. 미로그인이면 false(호출 페이지가 로그인으로 보냄).
export async function storePluginPairing(key: string): Promise<boolean> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;

  const rows = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const profile = rows[0];
  const payload = {
    ...tokens(session),
    user: {
      id: user.id,
      email: user.email ?? null,
      name: profile?.displayName ?? null,
      role: profile?.role ?? null,
    },
  };
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  await db
    .insert(pluginAuthPairings)
    .values({ key, payload, expiresAt })
    .onConflictDoUpdate({ target: pluginAuthPairings.key, set: { payload, expiresAt } });
  return true;
}

// 플러그인이 key로 폴링. 준비되면 토큰(로그인 응답과 동일 shape) 반환 + 즉시 삭제(1회용), 아니면 pending.
// 매 호출 시 만료 행을 베스트에포트로 정리한다.
export async function pollPluginPairing(input: unknown) {
  const { key } = pollSchema.parse(input);
  await db.delete(pluginAuthPairings).where(lt(pluginAuthPairings.expiresAt, new Date()));
  const rows = await db
    .select()
    .from(pluginAuthPairings)
    .where(eq(pluginAuthPairings.key, key))
    .limit(1);
  const row = rows[0];
  if (!row) return { status: "pending" as const };
  await db.delete(pluginAuthPairings).where(eq(pluginAuthPairings.key, key));
  return row.payload as {
    accessToken: string;
    refreshToken: string;
    expiresAt: unknown;
    user: { id: string; email: string | null; name: string | null; role: string | null };
  };
}
```

- [ ] **Step 3: 구식 로그인 라우트 삭제**

```bash
git rm app/api/plugin/auth/login/route.ts
```

(`pluginLogin`의 유일한 호출자였음. `refresh` 라우트는 유지.)

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 통과. `pluginLogin`/`loginSchema` 미사용 잔존 참조가 없어야 함(있으면 제거).

- [ ] **Step 5: 커밋**

```bash
git add src/features/auth/api/plugin-auth.server.ts app/api/plugin/auth/login/route.ts
git commit -m "feat(auth): 페어링 저장/폴링 서버 함수 + 구식 플러그인 로그인 제거"
```

---

### Task 3: 서버 — poll 라우트

**Files:**
- Create: `app/api/plugin/auth/poll/route.ts`

**Interfaces:**
- Consumes: `pollPluginPairing`(Task 2), `toErrorResponse`.
- Produces: `POST /api/plugin/auth/poll`.

- [ ] **Step 1: 라우트 작성**

`app/api/plugin/auth/poll/route.ts`:

```ts
import { NextRequest } from "next/server";
import { pollPluginPairing } from "@/features/auth/api/plugin-auth.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 플러그인이 페어링 key로 폴링. 준비되면 토큰, 아니면 { status: 'pending' }. CORS/CSRF는 proxy.ts 처리.
export async function POST(req: NextRequest) {
  try {
    return Response.json(await pollPluginPairing(await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 통과.

- [ ] **Step 3: pending 동작 수동 확인(dev 서버 가능 시)**

`npm run dev` 후:
Run: `curl -s -X POST http://localhost:3000/api/plugin/auth/poll -H "Content-Type: application/json" -d '{"key":"nope"}'`
Expected: `{"status":"pending"}`. key 누락 시 `{"error":"VALIDATION_ERROR",...}` 400.
(dev 서버를 못 띄우면 Task 8 수동 E2E로 미룬다.)

- [ ] **Step 4: 커밋**

```bash
git add app/api/plugin/auth/poll/route.ts
git commit -m "feat(api): 플러그인 페어링 poll 라우트"
```

---

### Task 4: 웹 — `/plugin-auth` 착지 페이지

**Files:**
- Create: `app/plugin-auth/page.tsx`

**Interfaces:**
- Consumes: `storePluginPairing`(Task 2), `redirect`(next/navigation).
- Produces: `GET /plugin-auth?k=<key>`.

- [ ] **Step 1: 페이지 작성**

`app/plugin-auth/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { storePluginPairing } from "@/features/auth/api/plugin-auth.server";

// 플러그인 로그인 페어링 착지점(외부 브라우저가 연다). 로그인돼 있으면 쿠키 세션의 토큰을 key로 저장하고
// 완료 안내를 띄운다. 미로그인이면 웹 로그인으로 보내고, 로그인 후 returnTo로 이 페이지에 복귀한다.
// 저장은 멱등 upsert이며 이 페이지는 전체 내비게이션으로 1회 도달하므로 렌더 중 저장이 안전하다.
export default async function PluginAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const { k } = await searchParams;
  if (!k) return <Centered title="잘못된 요청" message="페어링 키가 없습니다." />;

  const stored = await storePluginPairing(k);
  if (!stored) redirect(`/login?returnTo=${encodeURIComponent(`/plugin-auth?k=${k}`)}`);

  return (
    <Centered
      title="로그인 완료"
      message="피그마로 돌아가면 자동으로 로그인됩니다. 이 창은 닫아도 됩니다."
    />
  );
}

function Centered({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{message}</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 타입체크 + 빌드(라우트 등록 확인)**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 통과. (`redirect`가 throw로 흐름 종료 — `stored` 분기 정상.)

- [ ] **Step 3: 커밋**

```bash
git add app/plugin-auth/page.tsx
git commit -m "feat(web): /plugin-auth 페어링 착지 페이지(웹 로그인 재사용)"
```

---

### Task 5: 플러그인 — api.signInUrl + pollPairing (TDD path builder)

**Files:**
- Modify: `figma-plugin/src/ui/lib/api.ts`
- Modify: `figma-plugin/src/ui/lib/api.test.ts`

**Interfaces:**
- Consumes: 기존 `joinUrl`, `request`, `LoginResponse`.
- Produces:
  - `signInUrl(baseUrl: string, key: string): string`.
  - 타입 `PairingPollResponse = LoginResponse | { status: 'pending' }`.
  - ApiClient에 `pollPairing(key: string): Promise<PairingPollResponse>`.

(이 태스크에서는 `login()`을 **제거하지 않는다** — App이 아직 참조하므로 Task 7에서 함께 제거해 각 태스크 컴파일을 유지.)

- [ ] **Step 1: 실패하는 테스트 추가**

`figma-plugin/src/ui/lib/api.test.ts` import에 `signInUrl` 추가하고 describe 추가:

```ts
import { variantsPath, versionsPath, pagesPath, signInUrl } from './api';
```

```ts
describe('signInUrl', () => {
  it('key를 k 쿼리로, base 끝 슬래시 제거', () => {
    expect(signInUrl('https://x.dev/', 'abc')).toBe('https://x.dev/plugin-auth?k=abc');
  });
  it('key를 URL 인코딩', () => {
    expect(signInUrl('https://x.dev', 'a/b')).toBe('https://x.dev/plugin-auth?k=a%2Fb');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd figma-plugin && npx vitest run src/ui/lib/api.test.ts`
Expected: FAIL — `signInUrl` is not exported.

- [ ] **Step 3: api.ts 구현**

`joinUrl` 아래에 추가:

```ts
// 외부 브라우저로 열 사인인 URL. 웹 로그인 페이지가 returnTo로 이 페어링 착지점에 복귀시킨다.
export function signInUrl(baseUrl: string, key: string): string {
  return joinUrl(baseUrl, '/plugin-auth?k=' + encodeURIComponent(key));
}
```

`LoginResponse` 타입 아래에 추가:

```ts
export type PairingPollResponse = LoginResponse | { status: 'pending' };
```

`createApiClient` 반환 객체의 `login:` 항목 아래에 추가(login은 유지):

```ts
    pollPairing: (key: string) =>
      request<PairingPollResponse>('/api/plugin/auth/poll', {
        method: 'POST',
        body: JSON.stringify({ key }),
      }),
```

- [ ] **Step 4: 통과 확인**

Run: `cd figma-plugin && npx vitest run src/ui/lib/api.test.ts`
Expected: PASS (기존 3 + 신규 2 = 5 passed).

- [ ] **Step 5: 커밋**

```bash
git add figma-plugin/src/ui/lib/api.ts figma-plugin/src/ui/lib/api.test.ts
git commit -m "feat(figma-plugin): api.signInUrl + pollPairing"
```

---

### Task 6: 플러그인 — usePairingLogin 훅 + 에러 메시지

**Files:**
- Create: `figma-plugin/src/ui/hooks/usePairingLogin.ts`
- Modify: `figma-plugin/src/ui/lib/errors.ts`

**Interfaces:**
- Consumes: `ApiClient.pollPairing`(Task 5), `signInUrl`(Task 5), `API_BASE`, `SessionConfig`.
- Produces: `usePairingLogin(opts)` → `{ busy: boolean; error: string; start(): void; cancel(): void }`. `opts = { api, openUrl, onSuccess }`.

- [ ] **Step 1: 에러 메시지 추가**

`figma-plugin/src/ui/lib/errors.ts`의 `MSG`에 추가:

```ts
  OAUTH_TIMEOUT: '로그인 시간이 초과되었습니다. 다시 시도하세요.',
  OAUTH_FAILED: '로그인에 실패했습니다. 다시 시도하세요.',
```

- [ ] **Step 2: 훅 작성**

`figma-plugin/src/ui/hooks/usePairingLogin.ts`:

```ts
import { useCallback, useRef, useState } from 'react';
import { API_BASE } from '../config';
import { signInUrl, type ApiClient } from '../lib/api';
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

// 로그인 페어링: uuid 생성 → 외부 브라우저로 사인인 페이지 열기 → uuid로 폴링.
// 성공 시 onSuccess로 세션 전달. 타임아웃/취소 가능. (crypto.randomUUID는 Figma 데스크톱 iframe 제공)
export function usePairingLogin(opts: Opts) {
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
      const key = crypto.randomUUID();
      optsRef.current.openUrl(signInUrl(API_BASE, key));

      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (!cancelRef.current && Date.now() < deadline) {
        await delay(POLL_INTERVAL_MS);
        if (cancelRef.current) return;
        let res;
        try {
          res = await optsRef.current.api.pollPairing(key);
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

- [ ] **Step 3: 타입체크**

Run: `cd figma-plugin && npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 4: 커밋**

```bash
git add figma-plugin/src/ui/hooks/usePairingLogin.ts figma-plugin/src/ui/lib/errors.ts
git commit -m "feat(figma-plugin): usePairingLogin 폴링 훅 + 에러 메시지"
```

---

### Task 7: 플러그인 — Login 단일 버튼 + App 연결 + 구식 로그인 제거

**Files:**
- Modify: `figma-plugin/src/ui/components/Login.tsx`
- Modify: `figma-plugin/src/ui/App.tsx`
- Modify: `figma-plugin/src/ui/lib/api.ts` (login 제거)

**Interfaces:**
- Consumes: `usePairingLogin`(Task 6), `humanize`.

- [ ] **Step 1: Login.tsx 교체(단일 버튼 + 로그인 중)**

`figma-plugin/src/ui/components/Login.tsx` 전체를 아래로 교체:

```tsx
import { CovaLogo } from './CovaLogo';

export function Login({
  busy,
  errorText,
  onLogin,
  onCancel,
  onSignup,
}: {
  busy: boolean;
  errorText: string;
  onLogin: () => void;
  onCancel: () => void;
  onSignup: () => void;
}) {
  return (
    <section id="login">
      <div className="loginbody">
        <CovaLogo className="logo login-logo" width={106} height={26} />
        <h1 className="login-title">로그인</h1>
        <p className="login-sub">브라우저에서 로그인하면 자동으로 연결됩니다</p>

        {busy ? (
          <>
            <button type="button" disabled>
              로그인 중입니다…
            </button>
            <p className="login-sub" style={{ marginTop: 14 }}>
              열린 브라우저에서 로그인을 완료해주세요.
            </p>
            <div className="signup">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onCancel();
                }}
              >
                취소
              </a>
            </div>
          </>
        ) : (
          <button id="loginBtn" type="button" onClick={onLogin}>
            로그인하기
          </button>
        )}

        <div className="err" id="loginErr">
          {errorText}
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

- [ ] **Step 2: App.tsx 연결 + 이메일 로그인 제거**

`figma-plugin/src/ui/App.tsx` 수정:

(a) import 교체 — `SessionConfig` 타입 import 제거(미사용), 훅 import 추가:

```tsx
import { useSession } from './hooks/useSession';
import { usePairingLogin } from './hooks/usePairingLogin';
```

(`humanize`는 이미 import되어 있음 — 유지. `useSession` 줄에서 `type SessionConfig` 제거.)

(b) `loginBusy`/`loginErr` useState 2줄과 `doLogin` 함수 전체를 삭제. `api` useMemo 다음에 훅 추가:

```tsx
  const pairing = usePairingLogin({ api, openUrl: bridge.openUrl, onSuccess: session.setSession });
```

(c) `if (!isAuthed)` 블록을 아래로 교체:

```tsx
  if (!isAuthed) {
    return (
      <>
        <CovaLogoSymbol />
        <Login
          busy={pairing.busy}
          errorText={pairing.error ? humanize(pairing.error) : ''}
          onLogin={pairing.start}
          onCancel={pairing.cancel}
          onSignup={() => openUrl(API_BASE.replace(/\/+$/, '') + '/signup')}
        />
      </>
    );
  }
```

- [ ] **Step 3: api.ts에서 login 제거**

`figma-plugin/src/ui/lib/api.ts`의 `createApiClient` 반환 객체에서 `login:` 항목(이메일/비번 호출)을 삭제. `LoginResponse` 타입은 `PairingPollResponse`가 쓰므로 유지.

- [ ] **Step 4: 타입체크 + 빌드**

Run: `cd figma-plugin && npx tsc --noEmit && npm run build`
Expected: 타입 통과 + `dist/` 산출. (`doLogin`/`api.login`/`SessionConfig` 잔존 참조 0.)

- [ ] **Step 5: 플러그인 테스트 전체**

Run: `cd figma-plugin && npm test`
Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add figma-plugin/src/ui/components/Login.tsx figma-plugin/src/ui/App.tsx figma-plugin/src/ui/lib/api.ts
git commit -m "feat(figma-plugin): 로그인 화면을 단일 로그인 버튼+폴링으로 전환"
```

---

### Task 8: 검증 + 수동 운영 작업

**Files:** 없음(설정·검증)

- [ ] **Step 1: 전체 테스트(웹 + 플러그인)**

Run: `npm test`
Then: `cd figma-plugin && npm test`
Expected: 둘 다 PASS(기존 무관 실패는 별도 식별 — lint/format/locate.test.ts 기존 이슈).

- [ ] **Step 2: 웹 타입체크 + 빌드 스모크**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 통과.

- [ ] **Step 3: Supabase 리다이렉트 URL 확인(수동)**

기존 구글 로그인이 쓰는 `/auth/callback`을 그대로 재사용하므로 보통 추가 설정 불필요. 혹시 구글 로그인이 안 되면 Authentication → URL Configuration → Redirect URLs에 아래가 있는지 확인:
- `https://uxis-cova.vercel.app/auth/callback`
- (로컬) `http://localhost:3000/auth/callback`

- [ ] **Step 4: 마이그레이션 적용(대상 DB, 수동, Node ≥22)**

Run: `npm run db:migrate`
Expected: `plugin_auth_pairings` 생성.

- [ ] **Step 5: 수동 E2E**

플러그인 빌드본을 피그마에 로드 → 로그인 화면 "로그인하기" → 외부 브라우저에서 이메일 **또는** 구글 로그인 → "로그인 완료" 페이지 → 피그마로 복귀 시 자동 로그인 → 시안 목록/업로드 동작 확인. (구글 전용 계정으로도 확인.)

---

## Self-Review

**Spec coverage:**
- 단일 "로그인하기" 버튼 + "로그인 중" → Task 7. ✓
- 웹 로그인 페이지 재사용(이메일+구글) → Task 4(`/plugin-auth`→`/login?returnTo`). ✓
- uuid 폴링 페어링 → Task 6(uuid 생성·폴링)·2(저장/폴링)·3(라우트). ✓
- DB 임시저장 5분 TTL·1회용 → Task 1·2. ✓
- 구식 이메일 로그인 제거 → Task 2(서버/라우트)·7(플러그인 UI/api.login). ✓
- pending 계정 허용 → role을 payload에 담아 반환, UI 경고 기존 유지. ✓
- 수동 Supabase/마이그레이션 → Task 8. ✓

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "TBD/적절히" 없음. ✓

**Type consistency:** `storePluginPairing(key)`/`pollPluginPairing(input)` 시그니처가 라우트·페이지 호출과 일치. `PairingPollResponse = LoginResponse | {status:'pending'}` → 훅에서 `'status' in res` 분기. `usePairingLogin` 반환 `{busy,error,start,cancel}`이 App/Login props(`busy/errorText/onLogin/onCancel`)와 일치. `signInUrl`은 `/plugin-auth?k=`, 폴링은 `/api/plugin/auth/poll`. 컴파일 순서: api.login은 Task 7에서 doLogin과 함께 제거(그 전까지 유지). ✓
