# 뷰어 로그인/핀 플로우 재정비 + 관리 라우트 `/studio` 이동 설계

> 작성일: 2026-06-19
> 선행: Phase 5 Stage 2b(핀) 완료(`2026-06-17-phase5-stage2b-pins-design.md`), 리팩터 Stage 0–6 완료
> 비고: 공개 뷰어의 **로그인/핀 진입 플로우**가 여러 지점에서 끊기는 문제를 고치고, **관리(시안 등록·관리/사용자 관리) 라우트를 `/studio` 밑으로 통합**한다. 핀의 "로그인 필수" 정책은 유지(Stage 2b 결정 계승), 단 그 플로우를 완성한다.

공유 링크로 들어온 뷰어가 핀을 남기려다 만나는 끊김을 없앤다: (A) 로그인·가입 후 보던 시안으로 복귀, (B) 로그인하면 어디서나 실명으로 표시, (C) 핀 팝업 외에도 상시 로그인 진입점 제공, (D) 가입만 한(pending) 사용자가 `/` 접속 시 최근 본 시안 리스트 표시. 더불어 (E) 관리 화면 주소를 `/studio`로 통합한다.

## 0. 용어
| 용어 | 의미 |
|---|---|
| **게스트(guest)** | 비로그인 방문자. 실시간 신원(localStorage `uxis:identity`: `Guest 1234` + 색)만 가짐 |
| **뷰어 신원(viewer)** | 인증 세션 프로필 `{ id, displayName }`(role 무관). 비로그인=null |
| **viewerName** | 로그인 사용자의 표시명 = `displayName ?? email앞부분`(모든 role). 실시간 신원 이름을 덮어쓰는 값 |
| **pending** | `role='pending'`. 가입 직후 기본값. 대시보드/편집은 막히지만 **핀·채팅은 가능** |
| **returnTo** | 로그인/가입 성공 후 돌아갈 내부 경로. 오픈 리다이렉트 방지 검증(`isSafeInternalPath`) |
| **최근 본 시안(recent)** | 이 브라우저가 최근 연 공개 시안 목록(localStorage `uxis:recent`) |
| **관리 영역(/studio)** | 편집자/관리자용 시안 등록·관리 + 사용자 관리 화면. 가드 + 사이드바 |

## 1. 범위

**포함**
- A. `returnTo`를 핀 팝업 → 로그인 ↔ 가입 → 시안 복귀까지 끊김 없이 전달
- B. 로그인 사용자(role 무관)를 프레즌스/채팅에서 실명으로 표시(현재 편집자만 됨)
- C. 공개 뷰어에 상시 로그인 진입점(게스트 한정) 추가
- D. pending 사용자가 `/` 접속 시 최근 본 시안 리스트(localStorage) 표시 + 시안 뷰 진입 시 기록
- E. 관리 라우트(`/dashboard/*`, `/admin/users`)를 `/studio/*`로 이동 + 모든 참조 갱신

**제외 (YAGNI)**
- 핀을 게스트(비로그인)에게 허용하는 것 — **로그인 필수 정책 유지**
- 최근 본 시안의 서버(DB) 저장·기기 간 동기화 — localStorage만
- 비로그인 게스트에게 `/`에서 최근 리스트 노출 — pending 사용자만 (게스트는 기존대로 `/login`)
- API 라우트(`/api/proposals/*`, `/api/admin/users/*`) 경로 이동 — UX 주소만 이동, API는 그대로
- 이메일 확인(컨펌) 플로우 신설 — §6 전제로 처리(비활성 가정)
- `/pending` 페이지 문구/역할 개편 — 유지

## 2. 확정된 결정
| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| 1 | 핀 작성 권한 | **로그인 필수 유지** | 사용자 결정("로그인 유지 + 플로우 수정"). Stage 2b 정책 계승 |
| 2 | pending의 핀 권한 | **가입 즉시 가능(로그인=충분)** | 사용자 결정. `pending`은 관리 권한만 제한. 현 `create-pin-comment` 동작과 일치(role 미검사) |
| 3 | 로그인 후 실명 표시 | **모든 role**(편집자 한정 → 전체) | 사용자 요구("로그인해도 guest로 뜸"). `viewer.displayName`이 이미 전 사용자분 존재 |
| 4 | 상시 로그인 진입점 위치 | **PresenceBar(우상단)** | 이미 상시 떠 있는 오버레이. 별도 헤더 추가 불필요 |
| 5 | 최근 본 시안 추적 | **localStorage** | 사용자 결정. 기존 localStorage 신원 모델과 일관, 가입 전 게스트 조회도 포함, DB/쓰기 없음 |
| 6 | 최근 리스트 노출 대상 | **pending 사용자만** | 사용자 결정. 게스트는 `/login`, 편집자/관리자는 `/studio` |
| 7 | 관리 주소 prefix | **`/studio`** | 사용자 결정. 뷰어 영역(`/p`)과 명확히 구분되는 작업 공간 |
| 8 | API 라우트 이동 | **안 함** | 내부 엔드포인트. 이동 시 RQ 훅 URL 전수 변경 + 회귀 위험, UX 이득 없음 |

## 3. 현재 구조 요약 (출발점)

```
app/
  page.tsx                         /          home-page: !profile→/login, editor→/dashboard, else→/pending
  pending/page.tsx                 /pending   승인 대기 안내 + 로그아웃
  (auth)/login/page.tsx            /login     returnTo searchParam 지원(이미)
  (auth)/signup/page.tsx           /signup    returnTo 미지원 → 가입 후 무조건 /pending
  (dashboard)/layout.tsx           가드(!profile→/login, !editor→/pending) + 좌측 사이드바
  (dashboard)/dashboard/page.tsx               /dashboard
  (dashboard)/dashboard/proposals/...          /dashboard/proposals[/new|/[id]]
  (dashboard)/admin/users/page.tsx             /admin/users (admin-only)
  p/[publicId]/layout.tsx          resolveViewerGate → RealtimeShell(editorName)
  p/[publicId]/page.tsx            게이트 분기(forbidden/need-password/allow) → PublicViewerPage(viewer)
proxy.ts                           /dashboard·/admin 미인증 → /login + 세션 리프레시
```

두 신원 체계가 공존: **실시간 신원**(localStorage, 채팅·프레즌스·커서)과 **인증 신원**(Supabase 세션→profiles, 핀). `editorName`만이 둘을 잇는데 편집자에게만 적용돼 비편집자 로그인은 실시간에서 "Guest"로 남는다.

## 4. 목표 구조

```
app/
  page.tsx                         /          home-page: !profile→/login, editor→/studio, else(pending)→<RecentProposals/>
  pending/page.tsx                 /pending   (유지)
  (auth)/login/page.tsx            /login     "가입" 링크에 returnTo 보존
  (auth)/signup/page.tsx           /signup    returnTo 수신 → 성공 시 returnTo 우선, 없으면 /pending
  studio/layout.tsx                가드 + 사이드바(링크 /studio/*)  ← (dashboard)/layout.tsx 이전
  studio/page.tsx                  /studio    → /studio/proposals 리다이렉트
  studio/proposals/...             /studio/proposals[/new|/[id]]
  studio/users/page.tsx            /studio/users (admin-only)
  p/[publicId]/layout.tsx          resolveViewerGate → RealtimeShell(viewerName)  ← editorName→viewerName
  p/[publicId]/page.tsx            allow 분기에서 PublicViewerPage(viewer, proposalTitle)
proxy.ts                           /studio 미인증 → /login (가드 경로 변경)
```

`(dashboard)` 라우트 그룹은 해체하고 `app/studio/`(자체 layout 보유)로 대체한다. `(auth)` 그룹은 유지.

## 5. 변경 상세

### A. `returnTo` 전 구간 전달
현재 흐름의 끊김: 핀 팝업은 `/login?returnTo=/p/abc`까지 만들지만 ① 로그인 페이지의 "가입" 링크가 `returnTo`를 버리고, ② 가입 폼은 `returnTo`를 무시하고 항상 `/pending`으로 보낸다.

- `app/(auth)/signup/page.tsx`: `searchParams: Promise<{ returnTo?: string }>` 읽어 `<SignupPage returnTo={returnTo} />`로 전달(로그인 페이지와 동형).
- `src/pages/signup/ui/signup-page.tsx`: `returnTo` prop 수신 → `<SignupForm returnTo={returnTo} />`. "로그인" 링크 `href`에 `returnTo` 보존(`returnTo ? '/login?returnTo='+encodeURIComponent(returnTo) : '/login'`).
- `src/features/auth/ui/signup-form.tsx`: `returnTo` prop 추가. 성공 시 `router.replace(isSafeInternalPath(returnTo) ? returnTo : "/pending")` + `router.refresh()`.
- `src/pages/login/ui/login-page.tsx`: "가입" 링크 `href`에 `returnTo` 보존(동형).

결과: 핀 클릭 → `/login?returnTo=/p/abc` → "가입" → `/signup?returnTo=/p/abc` → 가입 후 `/p/abc` 복귀, 로그인 상태(pending)로 바로 핀 작성.

### B. 로그인 후 "Guest" 표시 해결
근본 원인: `resolveViewerGate`가 `editorName: editor ? displayName : null`(편집자 전용)을 반환하고, 실시간 신원 덮어쓰기가 이 값에만 의존 → 로그인한 pending/뷰어는 "Guest"로 남음. (핀 레이어의 `isGuest`는 `pin.viewerId == null` 기반이라 로그인 시 이미 정상.)

- `src/shared/access/resolve-viewer-gate.server.ts`: 반환 타입의 `editorName` → **`viewerName`**으로 교체. 값 = `profile ? (profile.displayName ?? profile.email.split("@")[0] ?? null) : null`(핀 authorName 폴백과 동일 규칙). forbidden 조기반환의 필드명도 갱신.
- `app/p/[publicId]/layout.tsx`: `const { decision, viewerName } = await resolveViewerGate(...)` → `<RealtimeShell viewerName={viewerName}>`.
- `src/widgets/realtime-shell/ui/realtime-shell.tsx`: prop `editorName` → `viewerName`. `loadOrCreateIdentity(viewerName)` 호출 및 deps 갱신. PresenceBar에 로그인 여부(`isAuthed = viewerName != null`) 전달(§C).
- `src/shared/realtime/identity.ts`: `loadOrCreateIdentity(editorName)` 파라미터명 `displayName`(또는 `authedName`)로 정리, 주석을 "로그인 사용자(role 무관)" 의미로 수정. 로직(있으면 이름 덮어쓰기)은 동일.

소비처가 layout 1곳뿐이라 안전한 의미 교체.

### C. 상시 로그인 진입점(PresenceBar)
- `src/widgets/realtime-shell/ui/presence-bar.tsx`: prop `isAuthed: boolean` 추가. `!isAuthed`일 때만 "로그인" 링크 렌더 → `href` = `/login?returnTo=<현재 pathname+search>`(핀 팝업과 동일하게 `window.location`에서 구성; SSR 가드). 로그인 상태면 미표시(이름·(나) 그대로).
- `RealtimeShell`이 `isAuthed`를 내려줌(§B).

`forbidden`/`need-password` 분기엔 이미 로그인 링크가 있으므로 `allow`(셸 마운트) 경우만 보강하면 전 케이스 커버.

### D. `/` 최근 본 시안 리스트 (pending 한정, localStorage)

**저장 헬퍼** — `src/shared/recent/recent-proposals.ts`(신규, 순수·테스트 가능):
- 타입 `RecentProposal = { publicId: string; title: string; viewedAt: number }`.
- `addRecent(entry)`: localStorage `uxis:recent` 읽기 → 동일 `publicId` 제거 → 맨 앞 삽입 → 상한 N(=20) 절단 → 저장. localStorage 미존재/파싱 실패 안전 처리.
- `loadRecent(): RecentProposal[]`: 파싱·검증된 목록(최신순). 손상 항목 필터.
- `viewedAt`는 호출부에서 `Date.now()`로 채워 전달(순수 헬퍼는 시간 입력만 받음 → 테스트 용이).

**기록** — 공개 뷰어가 `allow`일 때만:
- `app/p/[publicId]/page.tsx`: `allow` 분기에서 `proposal.title`을 client로 전달 → `<PublicViewerPage publicId={publicId} viewer={...} proposalTitle={proposal.title} />`.
- `src/pages/public-viewer/ui/public-viewer-page.tsx`: `proposalTitle` prop 추가, `useEffect(() => addRecent({ publicId, title: proposalTitle, viewedAt: Date.now() }), [publicId, proposalTitle])`로 기록. (게스트·로그인 무관하게 이 브라우저 기록.)

**표시** — pending 사용자의 `/`:
- `src/pages/home/ui/home-page.tsx`: 분기 변경 — `!profile → redirect("/login")`(유지), `isEditor → redirect("/studio")`, **else(pending) → `<RecentProposalsPage />`(client) 렌더**(redirect 아님).
- `src/pages/recent-proposals/ui/recent-proposals-page.tsx`(신규, client): `loadRecent()`로 목록 렌더. 각 항목 → `<Link href={'/p/'+publicId}>` (제목 + 상대시각/날짜). 비었으면 안내("최근 본 시안이 없습니다") + 보조 안내(예: 승인 대기 상태 한 줄, `/pending`은 별도 유지). localStorage는 client-only라 마운트 전엔 빈/로딩 처리(하이드레이션 안전, identity 패턴과 동일).

접근은 항상 클릭 시 `/p/[publicId]` 게이트에서 재검증되므로, 캐시된 항목이 비공개/삭제로 바뀌어도 안전(게이트가 처리).

### E. 관리 라우트 `/studio` 이동

**디렉터리 이동(URL 변경):**
- `app/(dashboard)/layout.tsx` → `app/studio/layout.tsx`(가드 + 사이드바 동일, 링크만 갱신).
- `app/(dashboard)/dashboard/page.tsx` → `app/studio/page.tsx`(`/studio` → `/studio/proposals` 리다이렉트로 유지/단순화).
- `app/(dashboard)/dashboard/proposals/**` → `app/studio/proposals/**`(`page.tsx`, `new/page.tsx`, `[id]/page.tsx`).
- `app/(dashboard)/admin/users/page.tsx` → `app/studio/users/page.tsx`(admin-only 가드 페이지 내부 유지).
- 빈 `(dashboard)` 그룹 폴더 제거.

**참조 갱신(8지점):**
| 파일 | 현재 | 변경 |
|---|---|---|
| `proxy.ts:40` | `startsWith("/dashboard") \|\| startsWith("/admin")` | `startsWith("/studio")` |
| `app/studio/layout.tsx`(구 dashboard layout) L18 | `/dashboard/proposals` | `/studio/proposals` |
| 〃 L24 | `/admin/users` | `/studio/users` |
| `app/studio/users/page.tsx`(구 admin/users) L8 | `redirect("/dashboard")` | `redirect("/studio")` |
| `src/features/edit-proposal-settings/ui/proposal-settings.tsx:58` | `router.push("/dashboard/proposals")` | `/studio/proposals` |
| `src/features/create-proposal/ui/proposal-create-form.tsx:45` | `/dashboard/proposals/${id}` | `/studio/proposals/${id}` |
| `src/features/auth/ui/login-form.tsx:38` | 기본 `"/dashboard"` | `"/studio"` |
| `src/pages/proposals-list/ui/proposals-list-page.tsx:17,59` | `/dashboard/proposals/new`, `/dashboard/proposals/${id}` | `/studio/proposals/...` |
| `src/pages/home/ui/home-page.tsx:8` | editor→`/dashboard` | editor→`/studio` (pending 분기는 §D) |

**유지:** `app/api/**`(API 경로), `/pending`, `/login`, `/signup`, `/p/[publicId]`. `tests/shared/lib/safe-redirect.test.ts`의 `"/dashboard"` 예시는 경로 검증 단위 테스트라 무관(선택적으로 `"/studio"`로 정리 가능).

## 6. ⚠️ 전제 / 리스크
- **이메일 확인 비활성 가정**: A/D는 "가입 직후 세션 존재"에 의존한다. auth 콜백 라우트가 없고 현 가입 흐름이 로그인됨을 가정하므로 비활성일 가능성이 높으나, **Supabase Auth 설정에서 직접 확인 필요**. 활성이면 가입 후 세션이 없어 복귀해도 게스트 → "이메일 확인 안내" 화면이 별도로 필요(범위 확대). → 구현 착수 전 1차 확인 항목.
- **라우트 이동 누락 위험**: `/dashboard`·`/admin` 문자열 잔존 시 깨진 링크/가드 우회. 구현 시 전수 grep으로 0건 확인(아래 테스트).
- **localStorage 잔존 이름**: 로그인 시 실명이 localStorage에 저장돼 로그아웃 후에도 남을 수 있음(공용 PC 경미 노출). 기존 편집자 동작과 동일 → 이번 범위 밖(메모만).
- **pending 사용자가 `/studio` 직접 접근**: 가드가 `/pending`으로 보냄(유지). `/`만 최근 리스트.

## 7. 영향 파일 한눈에
```
# A. returnTo
app/(auth)/signup/page.tsx                              (수정)
src/pages/signup/ui/signup-page.tsx                     (수정)
src/features/auth/ui/signup-form.tsx                    (수정)
src/pages/login/ui/login-page.tsx                       (수정)

# B. viewerName
src/shared/access/resolve-viewer-gate.server.ts         (수정: editorName→viewerName)
app/p/[publicId]/layout.tsx                             (수정)
src/widgets/realtime-shell/ui/realtime-shell.tsx        (수정)
src/shared/realtime/identity.ts                         (수정: 파라미터/주석)

# C. 로그인 진입점
src/widgets/realtime-shell/ui/presence-bar.tsx          (수정: isAuthed + 로그인 링크)

# D. 최근 본 시안
src/shared/recent/recent-proposals.ts                   (신규: add/load 헬퍼)
app/p/[publicId]/page.tsx                               (수정: proposalTitle 전달)
src/pages/public-viewer/ui/public-viewer-page.tsx       (수정: 기록 effect)
src/pages/home/ui/home-page.tsx                         (수정: pending 분기)
src/pages/recent-proposals/ui/recent-proposals-page.tsx (신규: 리스트 렌더)
src/pages/recent-proposals/index.ts                     (신규: 배럴)

# E. /studio 이동
app/(dashboard)/ → app/studio/                          (이동/재배치)
proxy.ts                                                (수정)
src/features/edit-proposal-settings/ui/proposal-settings.tsx   (수정)
src/features/create-proposal/ui/proposal-create-form.tsx       (수정)
src/features/auth/ui/login-form.tsx                     (수정: 기본 리다이렉트)
src/pages/proposals-list/ui/proposals-list-page.tsx     (수정)
```

## 8. 테스트
**단위(Vitest, 기존 패턴):**
- `recent-proposals.ts` — add: 신규 추가/동일 publicId 중복 제거(최신으로 승격)/상한 N 절단; load: 정상 파싱·손상 항목 필터·빈 저장소; 시간은 입력 주입.
- `resolve-viewer-gate` `viewerName` 산출 규칙(로그인+displayName / 로그인+displayName없음→email앞부분 / 게스트→null) — 순수부 분리 가능하면 분리, 아니면 헬퍼 함수로.
- `safe-redirect`/returnTo 분기(기존 테스트 유지, 필요 시 보강).

**정적 검증:**
- `npx tsc --noEmit` 통과.
- `/dashboard`·`/admin`(API 제외) 문자열 잔존 0건 grep 확인.

**수동 E2E(2탭/시크릿):**
1. 게스트로 `/p/abc` → 핀 클릭 → 로그인 → "가입" → 가입 → `/p/abc` 복귀 + 즉시 핀 작성 가능.
2. 로그인(pending/편집자) 후 프레즌스/채팅/핀에서 실명 표시(Guest 아님).
3. 게스트 뷰어 우상단 "로그인" 링크 → returnTo 복귀.
4. pending 사용자 `/` 접속 → 최근 본 시안 리스트(직전에 본 시안 포함), 항목 클릭 시 해당 시안.
5. `/studio` 이동: 편집자 로그인 → `/studio/proposals` 진입, 시안 생성/수정/사용자관리 링크 모두 동작, 미인증 `/studio/*` → `/login`.

## 9. Done 기준
공유 링크 뷰어가 핀을 남기려 할 때: 로그인 또는 가입을 마치면 보던 시안으로 돌아와 바로(가입 직후 pending 상태여도) 핀을 작성할 수 있고, 프레즌스·채팅·핀 어디서나 자신의 실명으로 표시된다. 뷰어는 핀 팝업 외에도 우상단에서 로그인할 수 있다. 가입만 한 사용자가 `/`에 접속하면 이 브라우저로 최근 본 시안 목록을 보고 다시 들어갈 수 있다. 시안 등록·관리와 사용자 관리는 모두 `/studio` 밑에서 동작하며 `/dashboard`·`/admin` UX 주소는 더 이상 존재하지 않는다(API 제외). `npx tsc --noEmit`와 단위 테스트가 통과한다.

## 10. 작업 형태
`feat/viewer-auth-studio` 브랜치(master 기준). 변경 묶음별 작은 커밋(A / B+C / D / E), 커밋마다 `npx tsc --noEmit` + Vitest 게이트. 라우트 이동(E)은 grep 0건 + 수동 진입 확인. 로그인·복귀·실시간 표시는 2탭 수동 검증. 완료 후 master ff-merge. **구현 착수 전 §6의 이메일 확인 설정을 먼저 확인.**
