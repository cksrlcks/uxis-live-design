# Phase 5 — 실시간 미팅(껍데기 상주: 참여자·커서·채팅·핀 코멘트) 설계

> 작성일: 2026-06-16
> 상위 설계: `docs/superpowers/specs/2026-06-15-uxis-live-design-design.md`
> 선행: Phase 4(멀티 안/variant) — 완료·머지
> 관련 결정: [[realtime-public-channel-decision]]
> 비고: 폐기된 옛 `feat/phase3a-realtime` 브랜치(52커밋 divergent, Phase 4 이전 뷰어 기준)를 **버리고 새 variant 뷰어 위에서 새로 설계**한다. 코드는 master에 없음(처음부터 구현).

공개 뷰어 `/p/[publicId]`에 **항상 보이는 실시간 미팅 레이어**(참여자 표시·실시간 커서·채팅·핀 코멘트)를 올린다. 레이어는 뷰어를 감싸는 **껍데기(shell)** 로 상주하여, **안 목록 화면부터** 보이고 안(`?v=`)·비교(`?compare=1`)로 이동해도 끊기지 않는다.

## 0. 용어

| 용어 | 의미 |
|---|---|
| **룸/채널** | 한 시안의 실시간 공간. Supabase Realtime 공개 채널 `proposal:<publicId>` 1개 |
| **참여자(presence)** | 지금 같은 룸을 보고 있는 사람(이름·색·현재 위치) |
| **위치(location)** | 그 참여자가 보는 화면 `{ view:'list'|'variant'|'compare', slug?, page? }` |
| **껍데기(RealtimeShell)** | 뷰어 콘텐츠를 감싸 참여자 바·채팅·커서 오버레이를 항상 렌더하는 클라이언트 셸 |

## 1. 범위

**포함**
- Presence: 참여자 아바타+이름 바, **안 목록부터 상존**, 안 전환에도 유지(같은 publicId 채널)
- 실시간 커서: 정규화 좌표 broadcast → 전원 오버레이 표시(이름 라벨). 같은-페이지 조건 없이 항상 보임
- 채팅: 시안 단위 1개 방, 저장 + 실시간 반영
- 핀 코멘트: 특정 안의 그 버전 페이지에 좌표 고정, 저장 + 실시간 반영, resolved 토글
- 게스트 신원: 자동 익명(`Guest N`+색), 사용자가 언제든 변경(localStorage 기억)
- 공개 뷰어 전용. 에디터 `/dashboard/proposals/[id]` 및 `/preview`는 비실시간 유지

**제외 (YAGNI)**
- 음성/영상, 타이핑 인디케이터, 읽음 표시
- private 시안의 채널 join 토큰 게이트(ephemeral 정보만 노출 → 수용, 후속 가능)
- 핀 코멘트 스레드/멘션/첨부(본문 + resolved까지만)
- 채팅/핀 알림(이메일 등)

**구현 2단계** (하나의 스펙, 두 개의 plan)
- **Stage 1 — ephemeral**: 채널 + Presence + 커서. 테이블 0개, BFF 0개. "들어오면 보임" 우선 달성
- **Stage 2 — 저장**: 채팅·핀 코멘트 테이블 + BFF(view-access 게이트) + 실시간 반영

## 2. 확정된 결정

| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| 1 | 전송 방식 | **Supabase Realtime 공개 채널** `proposal:<publicId>` (Presence+Broadcast) | 게스트 인증 복잡도 0, 테이블 미접근이라 deny-all RLS 무영향. [[realtime-public-channel-decision]] 재확인 |
| 2 | 레이어 위치 | **껍데기(shell)에 상주** | 안 목록부터 항상 보임, 안/비교 전환에도 유지 |
| 3 | 커서 좌표 | **정규화(0..1) 좌표, 전원 표시** | 같은-페이지 조건 없이 항상 보이게(사용자 요구). 라벨로 누구인지 구분 |
| 4 | 게스트 신원 | **자동 익명 + 사용자 변경, localStorage** | 입장 마찰 0, 서버 저장 불필요 |
| 5 | 채팅 범위 | **시안 단위 1방** | 미팅 대화는 안과 무관하게 하나로 |
| 6 | 핀 고정 기준 | **버전 스냅샷**(variant_id+version_id+page_order+좌표) | 비파괴 버전 철학과 일치, 논의 시점 보존 |
| 7 | 저장 보안 | **BFF 라우트 + view-access 재검증** | 채팅/핀은 테이블 기록 → 항상 코드 게이트(visibility+unlock) 통과 후에만 |
| 8 | 적용 범위 | **공개 뷰어 전용** | 에디터 화면은 비실시간(기존 결정) |

## 3. 아키텍처

```
app/p/[publicId]/page.tsx  (서버: 접근 게이트 decideAccess → allow일 때만)
  └─ <RealtimeShell publicId identitySeed initial={chat,pins}>   ← 클라이언트, 채널 1개 join
       ├─ <PresenceBar/>     참여자 아바타+이름, 내 이름 인라인 변경
       ├─ <CursorOverlay/>   전원 커서(정규화 좌표 → 현재 콘텐츠 영역에 매핑), 이름 라벨
       ├─ <ChatPanel/>       (Stage 2) 시안 채팅
       ├─ <PinLayer/>        (Stage 2) 핀 표시/작성 (안+페이지 컨텍스트)
       └─ children           = 기존 안목록/ProposalPreview/CompareView (서버에서 주입)
```

- **채널 1개** `proposal:<publicId>`. RealtimeShell이 mount 시 join, unmount 시 leave.
- **Presence**: `track({ name, color, location })`. location은 현재 URL(`?v`/`?compare`)과 프리뷰의 페이지 인덱스에서 파생. 위치 변경 시 presence 갱신.
- **Broadcast 이벤트**:
  - `cursor` `{ xNorm, yNorm }` — 콘텐츠 영역 기준 정규화. 수신 측이 자기 콘텐츠 영역 크기로 역매핑.
  - `chat` `{ id, name, color, body, createdAt }` — 저장 성공 후 즉시 반영(낙관적 + 권위는 BFF).
  - `pin` `{ ...pin }` 및 `pin_resolved` `{ id, resolved }` — 저장 후 반영.
- **신원**: `lib/realtime/identity.ts` — localStorage 키 `uxis:identity`에 `{name,color}`. 없으면 자동 생성(`Guest ` + 짧은 무작위 또는 presence 카운트, 색은 팔레트에서). 편집자는 로그인 displayName 우선.

## 4. Stage 1 — ephemeral (참여자 + 커서)

- `lib/realtime/channel.ts` — `channelName(publicId) => "proposal:" + publicId` (순수, 테스트).
- `lib/realtime/identity.ts` — 색 팔레트 + 이름 생성 + localStorage 로드/저장(순수 부분은 테스트, storage 접근은 분리).
- `lib/realtime/coords.ts` — `toNorm(px, rect)` / `fromNorm(n, rect)` 좌표 정규화(순수, 테스트).
- `components/realtime/realtime-provider.tsx` — 채널 lifecycle(join/leave, presence track, broadcast send/subscribe)을 context로 노출.
- `components/realtime/presence-bar.tsx` — 참여자 목록 + 내 이름 변경.
- `components/realtime/cursor-overlay.tsx` — pointermove를 throttle(예: rAF/50ms)해 broadcast, 수신 커서 렌더.
- 마우스 좌표는 **공유 콘텐츠 영역(ref)** 기준으로 정규화. 영역 밖이면 커서 숨김(`null` 좌표).
- Supabase 브라우저 클라이언트 재사용(`@/lib/supabase/client`의 `createSupabaseBrowser`, anon 키). 추가 env 불필요.

## 5. Stage 2 — 저장 (채팅 + 핀)

### 5.1 데이터 모델 (`drizzle/schema.ts`)
```
chat_messages
├─ id            uuid PK
├─ proposal_id   uuid → proposals (ON DELETE CASCADE)
├─ author_name   text NOT NULL
├─ author_color  text NOT NULL
├─ body          text NOT NULL
├─ created_at    timestamptz NOT NULL default now()
└─ index(proposal_id, created_at)

pin_comments
├─ id            uuid PK
├─ proposal_id   uuid → proposals (ON DELETE CASCADE)
├─ variant_id    uuid → proposal_variants (ON DELETE CASCADE)
├─ version_id    uuid → proposal_versions (ON DELETE CASCADE)
├─ page_order    int  NOT NULL          (버전 내 페이지 순번)
├─ x_norm        real NOT NULL          0..1
├─ y_norm        real NOT NULL          0..1
├─ author_name   text NOT NULL
├─ author_color  text NOT NULL
├─ body          text NOT NULL
├─ resolved      boolean NOT NULL default false
├─ created_at    timestamptz NOT NULL default now()
└─ index(variant_id, version_id, page_order)
```
- 두 테이블 모두 RLS `ENABLE` + `FORCE` (정책 없음 = deny). 접근은 Drizzle pooler 경유만(기존 컨벤션, `drizzle/README.md`).
- 마이그레이션은 `db:generate` 후 FK·RLS·index 수동 append(기존 방식).

### 5.2 접근 게이트 `lib/access/view-access.ts`
- `canViewProposal({ proposal, isEditor, hasValidUnlock }) => boolean` — 순수. 내부적으로 `decideAccess`를 재사용해 `"allow"` 여부 반환(편집자 OR 공개 OR 유효 unlock).
- BFF 라우트가 요청마다: 세션/쿠키 읽기 → 위 헬퍼 → false면 403.

### 5.3 BFF API (공개 뷰어 네임스페이스 `app/api/p/[publicId]/...`)
| 메서드/경로 | 동작 |
|---|---|
| `GET /api/p/[publicId]/chat` | 최근 메시지 N개 |
| `POST /api/p/[publicId]/chat` | 본문 검증(≤2000자) → 저장 → 작성 메시지 반환(클라가 broadcast) |
| `GET /api/p/[publicId]/pins?variant=&version=` | 그 버전의 핀 목록 |
| `POST /api/p/[publicId]/pins` | `{variantId,versionId,pageOrder,xNorm,yNorm,body,authorName,authorColor}` 검증·소속확인 → 저장 |
| `PATCH /api/p/[publicId]/pins/[pinId]` | `{resolved}` 토글 |
- 전부 `canViewProposal` 게이트. 작성자 이름/색은 클라이언트가 보내되 본문·길이·소속(variant→proposal, version→variant)만 서버가 검증.
- 초기 채팅/핀은 서버 컴포넌트(`page.tsx`)에서 1차 로드해 `RealtimeShell`에 주입(빈 화면 깜빡임 방지), 이후 broadcast로 증분.

## 6. 화면/파일

```
app/p/[publicId]/page.tsx          allow 분기에서 children을 <RealtimeShell>로 감싸 렌더(서버→클라 경계)
components/realtime/
├─ realtime-provider.tsx           채널 lifecycle + context (use client)
├─ realtime-shell.tsx              껍데기: provider + presence-bar + cursor-overlay + chat + pin layer 조립
├─ presence-bar.tsx                참여자 + 내 이름 변경
├─ cursor-overlay.tsx              커서 송수신/렌더
├─ chat-panel.tsx                  (Stage 2)
└─ pin-layer.tsx                   (Stage 2)
lib/realtime/
├─ channel.ts                      channelName (순수·테스트)
├─ identity.ts                     이름/색 생성 + localStorage (순수부 테스트)
└─ coords.ts                       정규화 좌표 (순수·테스트)
lib/access/view-access.ts          canViewProposal (순수·테스트)
app/api/p/[publicId]/chat/route.ts · pins/route.ts · pins/[pinId]/route.ts   (Stage 2, BFF)
drizzle/schema.ts                  chat_messages · pin_comments (Stage 2)
```

## 7. 보안 요약
- presence/cursor는 ephemeral. RealtimeShell은 서버 게이트(`decideAccess==="allow"`) 통과 후에만 마운트 → 정상 흐름에서 비인가 노출 없음.
- 채널은 공개라 publicId를 아는 외부인이 raw channel에 join하면 **ephemeral 정보(누가 보는지·커서)만** 보일 수 있음 → 수용(민감 데이터 아님). private/비번 시안의 저장 데이터(채팅·핀)는 전부 BFF `view-access` 게이트라 노출 안 됨.
- 저장 테이블은 RLS force deny + Drizzle 경유. 작성 시 본문 길이·소속 검증.

## 8. 테스트
순수 로직 단위 테스트(기존 패턴):
- `lib/realtime/channel.ts` — 채널명 형식
- `lib/realtime/identity.ts` — 이름/색 생성(팔레트 범위·다양성), 잘못된 저장값 폴백
- `lib/realtime/coords.ts` — toNorm/fromNorm 왕복, 영역 밖 클램프/널
- `lib/access/view-access.ts` — private/public/비번 분기(decideAccess 위임 확인)
I/O·실시간·broadcast는 plan의 수동 검증 단계(2개 탭 동시 접속으로 presence/커서/채팅/핀 확인).

## 9. Done 기준
**Stage 1**: 두 사람이 같은 `/p/[publicId]`를 열면 **안 목록 화면부터** 서로의 참여자 표시와 커서가 보이고, 안/비교로 이동해도 끊기지 않는다. 게스트는 자동 이름이 부여되고 직접 바꿀 수 있다.
**Stage 2**: 채팅이 시안 단위로 저장·실시간 반영되고, 안의 특정 버전 페이지에 핀 코멘트를 남기고 resolved 토글할 수 있다. 채팅·핀은 BFF view-access 게이트를 통과한 경우에만 읽기/쓰기 가능하며, 두 테이블은 RLS force deny 백스톱을 가진다.

**작업 형태**: `feat/phase5-realtime` 브랜치, 태스크별 작은 커밋, 커밋마다 `npx tsc --noEmit` + Vitest 게이트, Stage 1 → Stage 2 순. 브라우저 E2E(2탭)는 각 stage 끝 수동 검증. 완료 후 master ff-merge.
