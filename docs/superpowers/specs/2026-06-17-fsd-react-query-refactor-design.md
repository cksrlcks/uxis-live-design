# 아키텍처 리팩터링 설계 — FSD + React Query + Zod/RHF + No-SSR-Fetch

- 날짜: 2026-06-17
- 상태: 사용자 검토 대기
- 범위: 전체 프론트엔드 구조 + 데이터 패칭/검증 레이어 재구성
- 검증: 5-렌즈 적대적 감사 통과 (mapping/next16/fsd/security/consistency), 지적사항 반영됨

## 1. 목표 (Goals)

1. **React Query 도입** — 모든 데이터 조회를 React Query로 일원화.
2. **Zod + React Hook Form 도입** — 모든 폼을 RHF로, 검증을 Zod로. 검증 스키마는 클라이언트(RHF resolver)와 서버(route handler / server action `.parse`)가 **한 벌**을 공유.
3. **단일 조회 함수 + 권한 체크** — 각 읽기는 가드를 먼저 호출하는 단일 서버 함수로 만들고, 권한 체크가 누락된 읽기가 없는지 감사.
4. **No SSR (데이터 패칭 한정)** — RSC에서의 데이터 패칭 제거. 페이지는 클라이언트 컴포넌트 + React Query로 조회. **권한 체크와 인증 게이팅(redirect)은 서버에 유지**(보안 경계).
5. **FSD 적용** — 공식 가이드(Next.js / React Query) 기준으로 레이어 재배치.
6. **가독성** — 마이그레이션하는 파일마다 다중행 JSX/블록 분리, Prettier로 포맷 자동 강제.

## 2. 비목표 (Non-Goals)

- 비즈니스 로직/기능 변경 없음 (순수 구조 + 데이터 레이어 리팩터링).
- DB 스키마 변경 없음. 인증 메커니즘(Supabase 쿠키) 변경 없음. 새 기능 추가 없음.

## 3. 핵심 결정 (확정)

| 주제 | 결정 |
|---|---|
| "SSR 하지마"의 범위 | 데이터 **패칭**만 클라이언트(React Query)로. 권한 체크 + 인증 게이팅(redirect)은 서버 유지 |
| 권한 체크 위치 | route handler(`app/api`) + server action이 보안 경계. 쿠키 권한은 클라가 위조 가능하므로 서버에서만 신뢰 |
| 진행 방식 | 점진적 슬라이스 마이그레이션 (도메인 한 조각씩, 각 단계 후 앱 정상 동작) |
| 실시간(핀/채팅) | 데이터는 React Query — 초기 로드 = `useQuery`, 채널 이벤트 = 캐시 무효화/패치. 채널/프레즌스/커서 같은 ephemeral 상태는 `shared/realtime` 컨텍스트 유지 |
| 서버 조회 함수 위치 | `entities/{e}/api/*.server.ts`에 co-locate (`import "server-only"`) |
| alias | `@` → `src`. 루트 `drizzle/`는 `@drizzle/*` 별도 alias |
| Prettier | 도입 (Stage 0). 플러그인: `prettier-plugin-tailwindcss` (Tailwind 사용 중) |

## 4. 타깃 아키텍처 & 폴더 구조

FSD 공식 Next.js 가이드 + **Next 16 실제 동작** 기준:
- Next 라우팅 `app/`은 **프로젝트 루트**에 유지하고 `src/pages`(FSD 레이어)에서 re-export.
- `@/* → ./src/*`. FSD 레이어: `src/{app,pages,widgets,features,entities,shared}`.
- 미들웨어는 루트 — Next 16이라 `proxy.ts`가 그 역할.
- **빈 `pages/` 폴더는 불필요** — 루트 `app/`가 존재하면 Next 16은 `src/pages`를 Pages Router로 취급하지 않음(`node_modules/next/dist/docs/.../src-folder.md`: "src/app or src/pages will be ignored if app or pages are present in the root directory"). 현재 프로젝트도 `pages/` 없이 정상 빌드됨. `src/pages`는 **FSD 레이어일 뿐 Next Pages Router와 무관**(이름만 같음).
- **`src/app` 주의(이름 충돌)**: 루트 `app/`가 존재하므로 Next는 `src/app`을 라우터로 **무시**한다. 따라서 `src/app`은 FSD app 레이어(providers/styles)로만 쓰고 **page/layout/route/loading 파일을 절대 두지 않는다**(Stage 0 수용 기준에 grep 검사 포함).

```
app/                          # Next 라우팅 (얇게, 서버). page.tsx = @/pages에서 re-export
  layout.tsx                  #   루트: NuqsAdapter(유지) + QueryProvider + ThemeProvider
  page.tsx                    #   '/' 서버 redirect (getProfile→role) = 인증 경계, 유지
  (auth)/{login,signup}/page.tsx
  (dashboard)/layout.tsx      #   서버 게이트: getProfile + redirect (보안 경계, 유지)
  (dashboard)/dashboard/{,proposals/,proposals/new/,proposals/[id]/}page.tsx
  (dashboard)/admin/users/page.tsx
  pending/page.tsx
  p/[publicId]/{layout,page,loading}.tsx
  api/…                       # ★ route handler = 서버 보안 경계 (권한/게이트 체크 위치)
  favicon.ico                 # Next 컨벤션, app/ 유지
proxy.ts                      # Next16 미들웨어 (루트 유지) + same-origin(CSRF) 검사 추가
drizzle/                      # 스키마/마이그레이션 (서버 전용, 루트 유지) → @drizzle/* alias
src/
  app/        providers/(query-provider, theme-provider) · styles/(globals.css)
              (※ 라우트 파일 금지)
  pages/      home/ dashboard-home/ proposals-list/ proposal-new/ proposal-detail/
              admin-users/ public-viewer/ login/ signup/ pending/
  widgets/    preview-canvas/ proposal-table/ variant-tabs/ realtime-shell/
  features/   create-proposal/ add-variant/ add-version/ version-actions/ proposal-settings/
              manage-user-role/ unlock-access/ pin-comment/ send-chat-message/ auth/
  entities/   proposal/ variant/ version/ page/ pin/ chat-message/ profile/
  shared/     api/(query-client, http, to-error-response) · ui/(기존 components/ui)
              · lib/(utils, cn, public-id, variant-slug, access-decision, constants)
              · auth/(role 술어 + guards.server.ts) · supabase/ · db/ · storage/(server)
              · realtime/(channel, identity, coords, realtime-provider 컨텍스트)
              · config/(fonts)
  legacy/     ← Stage 0에서 lib/+components/를 1:1 이동해 두는 임시 보관소.
              각 Stage가 여기서 슬라이스로 승격. Stage 6에 빈 폴더 삭제.
```

### 슬라이스 내부 구조 (예: proposal)

```
entities/proposal/
  api/
    proposal.query.ts          # queryOptions 팩토리 (클라)
    get-proposals.ts           # 클라 fetcher → GET /api/proposals
    get-proposal.ts            # 클라 fetcher → GET /api/proposals/[id]
    get-proposals.server.ts    # 서버 조회 함수 (가드 + Drizzle), import "server-only"
    get-proposal.server.ts
  model/types.ts               # 도메인 타입 (drizzle $inferSelect 재노출)
  index.ts                     # public API 배럴
features/create-proposal/
  api/use-create-proposal.ts   # useMutation
  model/schema.ts              # Zod (클라+서버 공유)
  ui/proposal-create-form.tsx  # RHF
  index.ts
```

### FSD 레이어 규칙 (하위는 상위를 import 금지: shared < entities < features < widgets < pages < app, 동일 레이어 슬라이스 간 cross-import 금지)

- **realtime 컨텍스트는 `shared/realtime`에 둔다.** `RealtimeProvider`/채널/프레즌스/커서는 entities(pin)·여러 widget이 함께 쓰는 횡단 관심사라 widget 슬라이스에 두면 레이어 위반이 생긴다. shared에 두면 모두 합법적으로 소비 가능.
- **`entities/{pin,chat-message}`는 순수 query/fetcher만** 갖는다. 채널 이벤트 → 캐시 패치(setQueryData/invalidate) 배선은 `widgets/realtime-shell`(또는 해당 widget)에서 `shared/realtime` + `queryClient`를 소비해 처리한다. → 이렇게 해야 entity가 상위(widget)를 import하지 않는다.
- **presence-bar / chat-panel / pin-layer / canvas-cursors는 독립 widget이 아니라 세그먼트**다. 오직 `widgets/realtime-shell`(채팅/프레즌스)·`widgets/preview-canvas`(커서/핀 레이어) 내부에서만 렌더되므로 그 슬라이스의 세그먼트로 둔다(동급 widget 간 cross-import 회피).

## 5. 횡단 규약

### 5.1 권한 / 보안 경계 (= 서버)

읽기별 현재 보호 상태를 정확히 구분(감사 결과 반영):

| 읽기 | 현재 보호 | 마이그레이션 시 필요 조치 |
|---|---|---|
| 시안 목록 | `(dashboard)/layout` redirect + `GET /api/proposals`(requireEditor) | 그대로 |
| 관리자 목록 | layout redirect + 페이지 내 isAdmin + `GET /api/admin/users`(requireAdmin) | 그대로 |
| 에디터 상세 **데이터** | layout redirect + `GET /api/proposals/[id]`(requireEditor) | 그대로 |
| 에디터 상세 **이미지(서명 URL)** | ❗ **가드된 GET 없음** (RSC `loadEditorVariants`) | **Stage 2: 가드된 GET 추가**(requireEditor 후 pages+서명URL) |
| 공개 뷰어 **콘텐츠(서명 URL)** | ❗ **가드된 GET 없음** (RSC `loadVariantsForProposal`, gate=allow) | **Stage 4: GET /api/p/[publicId]/variants 추가**(resolveViewerGate→allow만 데이터) |
| 채팅 히스토리 | ❗ **GET 없음** (RSC layout `loadRecentChat`, POST만 존재) | **Stage 5: GET chat 추가**(resolveViewerGate→allow) |
| 핀 목록 | `GET /api/p/[publicId]/pins`(gate=allow, **로그인 불요**) | 읽기=로그인 불요/쓰기=로그인 필요 비대칭 유지 |

규약:
```ts
// entities/proposal/api/get-proposals.server.ts
import "server-only";
export async function getProposals() {
  await requireEditor();                       // 가드 먼저 → throw FORBIDDEN
  return db.select().from(proposals).orderBy(desc(proposals.updatedAt));
}
// app/api/proposals/route.ts
export async function GET() {
  try { return Response.json(await getProposals()); }
  catch (e) { return toErrorResponse(e); }     // throw → 401/403 단일 매핑
}
```

- 순수 role 술어(`isEditor`/`isAdmin`)는 `shared/auth`(클라 안전). 가드(`requireEditor`/`requireAdmin`)는 `shared/auth/guards.server.ts`(`import "server-only"`).
- **공개 뷰어 게이트**: 새 함수를 만들지 않고 기존 `resolveViewerGate`(tri-state: `allow`/`need-password`/`forbidden`)를 서버 경계로 사용. **route handler는 `decision==='allow'`일 때만 데이터를 반환**하고 `need-password`/`forbidden`은 절대 콘텐츠를 주지 않는다(403). (앞선 초안의 `requireViewerAccess`는 실존하지 않는 함수라 폐기.)
- **server action도 자체 가드 필수**: Next 16 proxy docs(`proxy.md` Execution order)는 "Server Function은 사용처로의 POST로 처리되며 proxy matcher가 제외한 경로는 커버되지 않으니 각 Server Function 안에서 직접 인증/인가를 검증하라"고 명시. 따라서 `(auth)`·`unlock` 등 모든 변이 server action은 proxy에 의존하지 말고 내부에서 가드 호출.
- **Stage 6 권한 감사**는 route handler뿐 아니라 **모든 읽기·server action을 빠짐없이 표로** 나열해 각 가드를 확인한다.

### 5.2 CSRF / same-origin (서버액션→fetch 전환 시)

폼이 server action에서 클라 `fetch`로 옮겨가면 Next의 Origin 보호를 자동으로 받지 못한다. 쿠키(Supabase auth, `pu_<publicId>` unlock)는 `sameSite:'lax'`라 상태 변경 요청에 대한 명시적 방어가 필요.
- `proxy.ts`(또는 `shared/api/to-error-response`/route 공통 헬퍼)에서 상태 변경 메서드(POST/PATCH/DELETE)에 **same-origin(Origin/Sec-Fetch-Site) 검사**를 강제하고, `Content-Type: application/json`을 요구(simple-request 차단).
- 특히 고위험 변이(`PATCH /api/admin/users/[id]` 권한 변경, proposal delete)는 반드시 same-origin 검사 대상.

### 5.3 React Query

```ts
export const proposalQueries = {
  all:    () => ["proposals"] as const,
  lists:  () => [...proposalQueries.all(), "list"] as const,
  list:   () => queryOptions({ queryKey: proposalQueries.lists(), queryFn: getProposals }),
  detail: (id: string) =>
    queryOptions({ queryKey: [...proposalQueries.all(), "detail", id], queryFn: () => getProposal(id) }),
};
```

- `shared/api/http.ts` fetch 래퍼: 에러 정규화. **401 → `/login?returnTo=…`로 리다이렉트**(전역 처리), 그 외 상태코드는 에러 객체로 throw.
- `shared/api/query-client.ts` 기본값: **`staleTime` 기본 30초**(엔티티별 조정 가능), **4xx는 retry off**, devtools 포함.
- Provider는 `src/app/providers/query-provider.tsx`, 루트 `app/layout.tsx`에서 **`NuqsAdapter` 안쪽에** 주입.
- 변이는 `features/*/api/use-*.ts`의 `useMutation` → onSuccess에서 관련 키 `invalidateQueries`. **쿼리/뮤테이션 동일 파일 혼합 금지**.
- **실시간**: `widgets/realtime-shell`이 `shared/realtime` 채널을 구독, 이벤트 → `queryClient.setQueryData`(낙관적 패치) 또는 `invalidateQueries`. 초기 데이터는 `useQuery`. 기존 Context+useState 기반 핀/채팅 **데이터** 상태는 RQ 캐시로 대체하고, 채널/프레즌스/커서 **세션** 상태만 `shared/realtime` 컨텍스트로 유지.
- **nuqs 보존**: `useQueryState` 기반 URL 상태(view/variant 선택)는 preview/variant-tabs widget 마이그레이션 시 그대로 유지(또는 의식적으로 대체). `NuqsAdapter`는 루트 레이아웃에 유지.

### 5.4 Zod + RHF (단일 소스)

```ts
// features/create-proposal/model/schema.ts
export const createProposalSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요"),
  files: z.array(z.object({                       // 파일 메타데이터만 검증
    contentType: z.string(),
    size: z.number().max(MAX_PAGE_BYTES),
  })).min(1, "이미지를 1개 이상 선택하세요"),
});
export type CreateProposalInput = z.infer<typeof createProposalSchema>;
```

- 클라: `useForm({ resolver: zodResolver(createProposalSchema) })`. 파일 바이너리는 네이티브로 다루고 메타데이터(contentType/size)만 Zod 검증.
- 서버: route handler/server action에서 동일 스키마로 `.parse(body)`. **검증 로직 한 벌**.
- **login/signup 폼**: 데이터 패칭이 없으므로 RQ 미사용. **RHF+Zod로 클라 검증**만 입히고, 실제 인증 호출은 기존 **server action 유지**(Supabase auth; Next가 Origin 보호). 각 action은 §5.1대로 자체 검증.

### 5.5 가독성 / Prettier

- Stage 0에서 `prettier` + `prettier-plugin-tailwindcss` + eslint 연동 도입.
- 전역 일괄 포맷은 diff 노이즈가 크므로 **각 파일이 슬라이스로 승격될 때** 포맷 적용(다중행 JSX, 논리 블록 사이 빈 줄).

## 6. 점진 단계 (각 단계 끝 = 앱 정상 동작 + typecheck/lint/test 통과)

### Stage 0 · 기반 (동작 변경 없음)
**0a — 비파괴 alias 전환 (핵심):**
- 의존성 추가: `@tanstack/react-query`, `@tanstack/react-query-devtools`, `zod`, `react-hook-form`, `@hookform/resolvers`, `prettier`, `prettier-plugin-tailwindcss`.
- `tsconfig`/`vitest.config` alias: `@/* → ./src/*`, `@drizzle/* → ./drizzle/*`.
- **`lib/`+`components/`를 `src/legacy/`로 1:1 이동(git mv)** 후 코드모드로 import 치환: `@/lib/*→@/legacy/lib/*`, `@/components/*→@/legacy/components/*`, `@/drizzle/*→@drizzle/*`. → 루트 `app/**`(page/route)가 참조하는 모든 `@/...`가 즉시 재해석되어 **중간 단계에서도 깨지지 않음**. typecheck로 검증.
- `components.json` alias 갱신(`ui:@/shared/ui`, `utils:@/shared/lib/utils`, `components:@/shared`, `css:src/app/styles/globals.css`) — shadcn CLI 유지.

**0b — shared 승격 + provider:**
- `src/legacy`에서 명백한 공용 모듈을 `shared/`로 승격(importer 갱신): `components/ui`→`shared/ui`, `lib/utils`→`shared/lib`, `lib/auth/roles`→`shared/auth`(술어), `lib/auth/session`의 가드(`requireEditor`/`requireAdmin`)→`shared/auth/guards.server.ts`(`server-only`), `lib/supabase`→`shared/supabase`, `lib/db`→`shared/db`, `lib/realtime/*`+`components/realtime/realtime-provider`→`shared/realtime`, `lib/fonts`→`shared/config`, `lib/proposals/{public-id,variant-slug,constants,access(decideAccess)}`→`shared/lib`, `lib/proposals/storage`→`shared/storage`(`server-only`).
- `shared/api/{query-client,http,to-error-response}.ts` 추가.
- `src/app/providers/{query-provider,theme-provider}.tsx` 추가 후 루트 `app/layout.tsx`에 주입(**NuqsAdapter 보존**, 폰트 import 경로 갱신).
- 수용 기준: `src/app`에 라우트 파일(page/layout/route/loading) 없음 grep 확인.

### Stage 1 · proposals (CRUD 코어)
- `entities/proposal`: query 팩토리 + 클라 fetcher + 서버 조회 함수(requireEditor) + 타입.
- `app/api/proposals/route.ts`를 서버 조회 함수 호출 래퍼로 전환.
- 목록 페이지 SSR→클라: `src/pages/proposals-list`(useQuery), 루트 page는 re-export.
- `features/create-proposal`(RHF + Zod). 업로드 클라 헬퍼(`upload-client`)는 이 feature로 승격(또는 `shared` 클라 storage). `public-id`/`variant-slug`/`storage`(서버)·페이지 확정 라우트(`.../pages`)는 **기존대로 동작 유지**(엔티티 배선은 Stage 2로 위임).
- `app/page.tsx`(`/` redirect, 서버 경계 유지)→`src/pages/home` re-export, `dashboard/page.tsx`→`src/pages/dashboard-home`.

### Stage 2 · variants/versions (상세)
- `entities/{variant,version,page}` + 서버 조회 함수.
- proposal-detail 페이지 클라화(`src/pages/proposal-detail`).
- ❗ **에디터 상세 이미지 가드 읽기 추가**: `GET /api/proposals/[id]`를 확장하거나 전용 GET 추가 — `requireEditor()` 후 pages+서명 URL 반환(현재 가드된 엔드포인트 없음).
- `features/{add-variant,add-version,version-actions(restore),proposal-settings}`(RHF+Zod).
- route handler 전환: `proposals/[id]`, `.../variants`, `.../variants/[variantId]`, `.../versions`, `.../restore`, `.../versions/[versionId]/pages`(엔티티 배선 완성).
- `widgets/{variant-tabs,preview-canvas}` 승격(편집 프리뷰). **preview-canvas는 여기서 1회 구축**.

### Stage 3 · admin users (관리)
- `entities/profile` + 서버 조회 함수(`requireAdmin`).
- `src/pages/admin-users` 클라화. `features/manage-user-role`(`user-row-actions` 승격).
- route handler: `admin/users`, `admin/users/[id]`(권한 변경은 §5.2 same-origin 대상).

### Stage 4 · public viewer + access (민감)
- `src/pages/public-viewer` 클라화.
- ❗ **`GET /api/p/[publicId]/variants` 추가**: `resolveViewerGate(publicId)`를 **먼저** 호출, `decision==='allow'`가 아니면 403(콘텐츠 미반환), 통과 시 `loadVariantsForProposal`+서명 URL.
- `features/unlock-access`(`lib/access/*`→`entities`/`features`로 승격; `app/p/[publicId]/actions.ts` 정리, 각 action 자체 가드). `decideAccess`는 이미 Stage 0b에서 `shared/lib`로 이동됨.
- `p/[publicId]/layout.tsx`의 SSR 게이트는 **서버 경계로 유지**하되 데이터는 클라 패칭으로 이동.
- **preview-canvas는 Stage 2 산출물을 재사용**(신규 구축 없음, public-viewer에 배선만).

### Stage 5 · realtime (pins + chat)
- `entities/{pin,chat-message}`: query 팩토리 + 클라 fetcher + 서버 조회 함수(순수 read).
- ❗ **`GET /api/p/[publicId]/chat` 추가**: `resolveViewerGate→allow`만 `loadRecentChat` 반환(POST 가드 미러링).
- 핀 읽기 auth 계약 보존: **읽기=게이트 allow만(로그인 불요)**, 쓰기=allow+로그인, 본문 수정/삭제=allow+로그인+`authorId===profile.id`.
- `features/{pin-comment,send-chat-message}`(RHF+Zod).
- `widgets/realtime-shell`(= 채널 구독을 여는 top-level: chat-panel+presence-bar 세그먼트 호스팅, 채널 이벤트→캐시 패치/무효화). `canvas-cursors`/`pin-layer`는 `widgets/preview-canvas` 세그먼트로.
- 기존 Context 기반 핀/채팅 **데이터** 상태는 RQ 캐시로 대체; 채널/프레즌스/커서 세션 상태만 `shared/realtime` 유지.

### Stage 6 · 정리
- 빈 `src/legacy/` 삭제, 죽은 로더(`load-*`) 제거.
- **전체 권한 감사**: 모든 읽기·route handler·**server action**을 표로 나열해 가드 확인(§5.1 표 확장).
- 가독성 최종 패스 + Prettier 전체 확인.

## 7. 현재 → 타깃 매핑

| 현재 | 타깃 | Stage |
|---|---|---|
| `components/ui/*` | `shared/ui/*` | 0b |
| `lib/utils` | `shared/lib` | 0b |
| `lib/db`, `lib/supabase`, `lib/fonts` | `shared/db`, `shared/supabase`, `shared/config` | 0b |
| `lib/realtime/*` + `components/realtime/realtime-provider` | `shared/realtime` | 0b |
| `lib/auth/roles`(술어) | `shared/auth` | 0b |
| `lib/auth/session`(가드 requireEditor/requireAdmin) | `shared/auth/guards.server.ts` | 0b |
| `lib/proposals/{public-id,variant-slug,constants,access}` | `shared/lib` | 0b |
| `lib/proposals/storage` (server) | `shared/storage` (server-only) | 0b |
| `lib/proposals/upload-client` ('use client') | `features/create-proposal`(+add-version) 또는 shared 클라 storage | 1/2 |
| `app/page.tsx`(/ redirect), `dashboard/page.tsx` | `src/pages/home`, `src/pages/dashboard-home` | 1 |
| `app/.../proposals/page.tsx`(SSR), `proposals/new` | `src/pages/proposals-list`/`proposal-new` + `entities/proposal` + `features/create-proposal` | 1 |
| `app/.../proposals/[id]/page.tsx`(SSR) | `src/pages/proposal-detail` + `entities/{variant,version,page}` | 2 |
| `components/proposals/{add-variant,add-version,version-actions,proposal-settings}` | `features/{add-variant,add-version,version-actions,proposal-settings}` | 2 |
| `components/proposals/variant-tabs` | `widgets/variant-tabs` | 2 |
| `lib/preview/*`, `components/preview/{canvas-view,compare-view,fullscreen-slides,proposal-editor-preview,proposal-preview,variant-list,variant-viewer-nav,use-prefetch-images}` | `entities/variant`(Stage 2만) + `widgets/preview-canvas`(2 구축) | 2 |
| `app/.../admin/users/page.tsx`(SSR), `components/admin/user-row-actions` | `src/pages/admin-users` + `features/manage-user-role` + `entities/profile` | 3 |
| `app/p/[publicId]/*`, `lib/access/*`, `components/preview/public-viewer`, `components/preview/pin-layer` | `src/pages/public-viewer` + `features/unlock-access` + (preview-canvas 재사용) | 4 |
| `lib/pins/*` | `entities/pin` + `features/pin-comment` (+커서/핀레이어는 preview-canvas 세그먼트) | 5 |
| `lib/meeting/*` | `entities/chat-message` + `features/send-chat-message` | 5 |
| `components/realtime/{realtime-shell,presence-bar,chat-panel}` | `widgets/realtime-shell`(세그먼트로 통합) | 5 |
| `components/realtime/canvas-cursors` | `widgets/preview-canvas` 세그먼트 | 5 |
| `app/(auth)/actions.ts`, `(auth)/{login,signup}/page.tsx`, `pending/page.tsx` | `features/auth` + `src/pages/{login,signup,pending}` (server action 유지, 폼만 RHF+Zod) | 1 |

## 8. 리스크 & 완화

| 리스크 | 완화 |
|---|---|
| alias 전환이 중간 단계 import를 깨뜨림 | Stage 0a에서 `lib/`+`components/`를 `src/legacy`로 1:1 이동 + 코드모드로 `@→src` 즉시 전 경로 해석. `@drizzle` 분리로 서버 스키마 보호 |
| `server-only` 모듈을 클라가 실수로 import | `import "server-only"` 빌드 타임 throw. upload-client(클라)/storage(서버) 명시적 분리 |
| 클라 패칭 전환이 게이트 우회로 데이터 노출 | 콘텐츠 읽기(에디터 이미지/뷰어 콘텐츠/채팅)는 **가드된 GET 신설 후** 클라화. §5.1 표로 추적, Stage 6 감사 |
| 서버액션→fetch 전환의 CSRF | §5.2 same-origin + JSON-only. 고위험 변이 명시 |
| 실시간 캐시 동기화 복잡도 | Stage 5 단독. 데이터=RQ, 세션=shared/realtime 컨텍스트로 책임 분리 |
| FSD 레이어 위반(entity→widget, widget cross-import) | realtime 컨텍스트는 shared, presence/chat/cursor는 세그먼트로(§4 규칙) |
| nuqs URL 상태 유실 | NuqsAdapter 루트 보존 + widget 마이그레이션 시 useQueryState 유지 |
| 권한 누락(기존 RSC가 가드 없이 조회) | 모든 읽기를 서버 조회 함수로 강제 + Stage 6 감사(server action 포함) |

## 9. 검증 (각 Stage 공통)

- `npm run lint`, `npx tsc --noEmit`(또는 build), `npm test` 통과.
- 해당 슬라이스 화면 수동 동작 확인(권한별: editor/admin/viewer/guest).
- 권한 체크 동작 확인(비인가 요청 → 403; 게이트 need-password/forbidden → 콘텐츠 미반환).
- **No-SSR 달성 확인(Goal 4)**: 마이그레이션된 page/RSC가 데이터 패칭을 하지 않는지 grep(`*.server.ts`·route handler 밖에서 db/Drizzle 호출 없음, page는 useQuery로만 렌더). 서버측 인증 게이팅/redirect는 유지.
- **FSD 레이어 규칙 확인**: 하위→상위 import, 동급 widget cross-import 없음(eslint-boundaries 또는 수동 grep).
