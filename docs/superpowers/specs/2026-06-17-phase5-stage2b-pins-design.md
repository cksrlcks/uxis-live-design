# Phase 5 Stage 2b — 핀 코멘트(캔버스·로그인) 설계

> 작성일: 2026-06-17
> 상위 설계: `docs/superpowers/specs/2026-06-16-phase5-realtime-meeting-design.md` (§5 Stage 2)
> 선행: Stage 1(presence·커서) 완료·머지, Stage 2a(채팅) 완료(브랜치 `feat/phase5-chat`)
> 비고: 상위 스펙 §5의 **핀 부분을 이 문서가 갱신·구체화**한다. 핀을 **캔버스 뷰 전용 + 로그인 필수**로 확정(상위 스펙의 "이름/색만 보내는 게스트 핀" 가정은 폐기).

공개 뷰어 `/p/[publicId]`의 **단일 안 캔버스(pan/zoom) 뷰**에, 로그인한 사용자가 특정 페이지의 한 지점에 **핀 코멘트**를 남기고, 본인 핀을 수정·삭제하며, 누구든(로그인 사용자) resolved를 토글할 수 있게 한다. 핀은 안의 **현재 버전 스냅샷**에 고정되고 실시간으로 반영된다.

## 0. 용어
| 용어 | 의미 |
|---|---|
| **핀(pin)** | 특정 안의 그 버전 특정 페이지의 정규화 좌표(0..1)에 고정된 코멘트 |
| **코멘트 모드** | 캔버스에서 클릭=핀 배치로 동작하는 모드(일반 모드는 pan/zoom) |
| **뷰어 신원(viewer)** | 현재 인증 세션의 프로필 `{ id, displayName }`(role 무관). 비로그인=null |
| **콘텐츠 좌표** | 캔버스 transform 적용 전, `contentRef` 기준 픽셀 좌표(커서와 동일 좌표계) |

## 1. 범위

**포함**
- 캔버스 뷰 **모드 토글**: `일반`(pan/zoom) / `코멘트`(클릭=핀)
- 로그인 사용자가 핀 작성(인라인 팝오버 입력), 본인 핀 **수정·삭제**, 누구나(로그인) **resolved 토글**
- 핀은 **활성 안의 현재 버전** 페이지에 정규화 좌표로 고정, 저장 + 실시간 반영
- 게스트(비로그인): 핀 **보기 전용**. 코멘트 모드에서 클릭 시 **로그인 유도**(returnTo 복귀)

**제외 (YAGNI)**
- 스레드/대댓글/멘션/첨부, resolved 필터·정렬, 핀 이동(드래그 재배치)
- 풀화면 슬라이드·리스트·비교 뷰의 핀(캔버스 전용)
- 핀 알림(이메일 등), 과거 버전의 핀 표시(현재 버전만)

## 2. 확정된 결정
| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| 1 | 적용 뷰 | **캔버스 전용** | 사용자 결정. 캔버스는 이미 커서용 콘텐츠 좌표계·`--inv-scale` 인프라가 있어 재사용 |
| 2 | 배치 상호작용 | **모드 토글(일반/코멘트)** | 사용자 결정. 코멘트 모드에서만 클릭=핀, pan과 충돌 방지 |
| 3 | 입력 UX | **클릭 지점 인라인 팝오버** | 사용자 결정. 위치 맥락 명확(피그마/노션식) |
| 4 | 작성 권한 | **로그인 계정 누구나(pending 포함)** | 사용자 결정. 초대된 리뷰어가 가입만 해도 공개 시안에 피드백 |
| 5 | 소유권 | **세션 `profile.id` = `author_id`** | 게스트 임시 신원은 공개 채널에 노출돼 소유 증명 불가 → 로그인으로 서버 강제(능력 토큰 불필요) |
| 6 | 수정·삭제 | **작성자 본인만**(서버 강제) | 사용자 요구. `author_id == 세션 id` 불일치면 403 |
| 7 | resolved 토글 | **로그인 누구나 + 뷰권한** | 사용자 결정. 코멘트를 받은 디자이너/에디터가 '처리됨' 표시(상위 스펙 §5.3과 일치) |
| 8 | 핀 고정 기준 | **버전 스냅샷**(variant+version+page_order+x/y_norm) | 상위 스펙 결정 유지. 비파괴 버전 철학·논의 시점 보존 |
| 9 | 저장 보안 | **BFF + view-access 재검증 + 세션** | 핀은 테이블 기록 → `resolveViewerGate` 게이트 + 쓰기는 세션·소유권 검증 |

## 3. 아키텍처

```
app/p/[publicId]/layout.tsx (서버)
  └─ resolveViewerGate → { proposal, decision, editorName, viewer }   ← viewer={id,displayName}|null 추가
  └─ <RealtimeShell ... viewer={viewer}>                              ← 채팅 셸에 viewer 주입
       └─ <RealtimeProvider>  (pin/pin_updated/pin_deleted broadcast 핸들러 추가)
            └─ children = <PublicViewer variants viewer publicId>
                 └─ (활성 안 ?v=) <ProposalPreview variantId versionId pages>
                      └─ (캔버스 모드) <CanvasView ...>
                           ├─ 모드 토글(일반/코멘트)
                           ├─ <PinLayer>      활성(variant,version) 핀 GET + broadcast 병합, 렌더/팝오버
                           └─ <PinCapture>    코멘트 모드에서 클릭→페이지 hit-test→임시핀+작성 팝오버
```

- **뷰어 신원 전달**: `resolveViewerGate`가 `viewer: { id, displayName } | null`(로그인했으면 role 무관)을 추가 반환. 레이아웃→셸→뷰어→캔버스로 내려보내, 클라가 (a) 로그인 여부, (b) "내 핀"(`pin.authorId === viewer.id`) 판정, (c) 작성자 표시명을 안다. (기존 `editorName`은 유지하되 `viewer.displayName`에서 파생 가능.)
- **신원(이름/색)**: 핀 `author_id`와 `author_name`은 **서버 세션**에서만 취득(권위, 위조 불가) — `author_name = profile.displayName ?? 이메일 앞부분 ?? "사용자"`. `author_color`만 클라가 realtime 신원 색(`lib/realtime/identity.ts` 팔레트)으로 보냄(표시용, cosmetic).
- **페이지 컨텍스트 전달**: 캔버스/핀 레이어는 `variantId`, `versionId`(=활성 안 `currentVersionId`), 각 페이지의 `pageOrder`가 필요. `PreviewPage`에 `pageOrder` 필드를 추가하고(loadVariants가 이미 `proposalPages.pageOrder` 보유) 활성 변형의 `id`/`currentVersionId`를 함께 내려준다.

## 4. 좌표계 (커서 인프라 재사용)

캔버스는 `contentRef`(모든 페이지를 가로 flex row로 배치, transform으로 줌/팬) 안에 페이지 이미지를 **네이티브 크기**로 그린다. 커서의 `CanvasCursorCapture`와 동일하게:

1. **클릭 → 콘텐츠 좌표**: `scale = contentRect.width / content.offsetWidth`, `toContent(clientX, clientY, contentRect, scale) → { cx, cy }`(순수 함수 `lib/realtime/coords.ts` 재사용).
2. **페이지 hit-test**: 각 페이지 이미지의 `offsetLeft/offsetTop`(contentRef 기준) + `width/height`로 `(cx,cy)`를 포함하는 페이지 `i`를 찾는다. 어떤 페이지에도 안 들면(여백/패딩) **무시**.
3. **정규화**: `xNorm = (cx - offsetLeft_i) / width_i`, `yNorm = (cy - offsetTop_i) / height_i`(0..1 클램프). `page_order = pages[i].pageOrder`.
4. **렌더**: 핀 마커를 transform 레이어 **내부**에 `left = offsetLeft_i + xNorm*width_i`, `top = offsetTop_i + yNorm*height_i`로 두고, `transform: scale(var(--inv-scale))`·`transformOrigin: 0 0`으로 줌 무관 일정 크기·끝점 고정(커서 마커와 동일).

→ hit-test/정규화는 **순수 함수**(`lib/pins/locate.ts`: 입력 = 콘텐츠좌표 + 페이지 박스 목록, 출력 = `{ pageIndex, xNorm, yNorm } | null`)로 분리해 단위 테스트한다.

## 5. 모드 토글

- 캔버스 좌상단 플로팅 세그먼트(`일반`/`코멘트`). 기본 `일반`.
- `코멘트` 모드: `TransformWrapper`의 **panning 비활성**(`panning={{ disabled: true }}`), 휠 줌은 유지. 캔버스 클릭이 `PinCapture`로 간다.
- 커서 broadcast(`CanvasCursorCapture`)는 두 모드 모두 유지(다른 참여자에게 내 포인터 계속 표시).
- 핀 마커는 두 모드 모두 표시. 토글은 "새 핀 배치 가능 여부"만 좌우.

## 6. 로그인 게이팅 + returnTo

- **게스트가 코멘트 모드에서 클릭** → 작성 팝오버 대신 **로그인 유도 팝오버**("핀을 남기려면 로그인이 필요합니다 · [로그인]"). 링크: `/login?returnTo=/p/<publicId>`(현재 쿼리 포함).
- **login 액션 returnTo 지원 추가**(현재 `/dashboard` 하드코딩): 
  - `login/page.tsx`가 `searchParams.returnTo`를 읽어 폼 hidden input으로 전달.
  - `login` 서버 액션이 `formData.get("returnTo")`를 읽어, **내부 경로 검증**(반드시 `/`로 시작 + `//`·`/\` 아님 = 오픈 리다이렉트 방지) 후 성공 시 그 경로로 `redirect`. 없거나 부적합하면 기존대로 `/dashboard`.
- 게스트가 보기만 할 땐 핀이 읽기 전용(마커 클릭 시 본문·작성자·resolved 상태는 보이되, 작성/수정/삭제/resolved 토글 컨트롤은 숨김).

## 7. 데이터 모델 (`drizzle/schema.ts`)
```
pin_comments
├─ id            uuid PK
├─ proposal_id   uuid → proposals            (ON DELETE CASCADE)
├─ variant_id    uuid → proposal_variants    (ON DELETE CASCADE)
├─ version_id    uuid → proposal_versions    (ON DELETE CASCADE)
├─ page_order    int  NOT NULL               (버전 내 페이지 순번)
├─ x_norm        real NOT NULL               0..1
├─ y_norm        real NOT NULL               0..1
├─ author_id     uuid → profiles(id)         (ON DELETE SET NULL) — 소유권 강제 기준
├─ author_name   text NOT NULL               (작성 시점 표시 스냅샷)
├─ author_color  text NOT NULL
├─ body          text NOT NULL
├─ resolved      boolean NOT NULL default false
├─ created_at    timestamptz NOT NULL default now()
└─ index(variant_id, version_id, page_order)
```
- RLS `ENABLE` + `FORCE`(정책 없음 = deny). 접근은 Drizzle pooler 경유만(기존 컨벤션).
- 마이그레이션은 `db:generate` 후 FK·RLS·index 수동 append(기존 0003/0005 방식). FK는 스키마에 선언하지 않는다.

## 8. 접근/권한 모델

뷰 게이트는 기존 `resolveViewerGate`(visibility + unlock 쿠키 + 세션) 재사용. 쓰기는 추가로 세션·소유권 검증.

| 동작 | 허용 조건 | 실패 |
|---|---|---|
| 핀 보기(GET) | `decision === "allow"` | 403 |
| 핀 작성(POST) | allow + **세션 존재** | 세션없음 401 / 게이트 403 |
| 본문 수정(PATCH body) | allow + 세션 + **`pin.author_id === 세션.id`** | 비작성자 403 |
| resolved 토글(PATCH resolved) | allow + **세션 존재** | 401/403 |
| 삭제(DELETE) | allow + 세션 + **작성자 본인** | 403 |

- `author_id`와 `author_name`은 **항상 서버 세션**에서 취득(`author_name = profile.displayName ?? 이메일 앞부분 ?? "사용자"`, 위조 불가). `author_color`만 클라가 보냄(표시용 스냅샷, 길이 제한).
- 소속 검증: `variant.proposalId === proposal.id`, `version.variantId === variant_id`, `0 ≤ page_order < (그 버전 페이지 수)`. 위반 시 400.
- 본문 길이 ≤ 2000(채팅과 동일 헬퍼 `lib/meeting/chat.ts`의 `MAX_CHAT_BODY` 재사용 또는 `lib/pins`에 동등 검증).

## 9. BFF API (`app/api/p/[publicId]/pins/...`)
| 메서드/경로 | 동작 |
|---|---|
| `GET /api/p/[publicId]/pins?variant=&version=` | 그 버전의 핀 목록(DTO[]) |
| `POST /api/p/[publicId]/pins` | `{ variantId, versionId, pageOrder, xNorm, yNorm, body, authorColor }` → 세션·소속·본문 검증 → `author_id`·`author_name`은 세션에서, `author_color`는 페이로드에서 저장 → 저장 DTO 반환(클라가 broadcast) |
| `PATCH /api/p/[publicId]/pins/[pinId]` | `{ body }`(작성자만) **또는** `{ resolved }`(로그인 누구나) — 정확히 하나. 갱신 DTO 반환 |
| `DELETE /api/p/[publicId]/pins/[pinId]` | 작성자만. `{ id }` 확인 응답 |

- 전부 `resolveViewerGate` 게이트. 쓰기는 세션(`getProfile`) 필수.
- 초기 핀은 클라(PinLayer)가 활성(variant,version) 진입 시 `GET`으로 로드. 이후 broadcast로 증분(서버 주입 대신 GET — 핀은 버전별 lazy가 자연스러움).

## 10. 실시간

- **provider 확장**: `RealtimeProvider`가 `pin`(생성)·`pin_updated`(본문/resolved 변경)·`pin_deleted`(`{id}`) broadcast 핸들러를 **subscribe 이전** 등록(채팅·커서와 동일 제약). 수신 이벤트를 소비자(PinLayer)가 받을 수 있게 노출.
- **PinLayer**: 활성(variant,version) 핀을 `GET`으로 로컬 상태에 적재 + 해당 버전 대상 broadcast 병합(`id` dedupe, `pin_deleted`는 제거). 변형 전환 시 다시 로드.
- **쓰기 흐름**: 작성/수정/삭제/resolved는 BFF 호출 성공 후 그 결과를 broadcast(권위는 BFF, 송신자는 self:false라 로컬 즉시 반영).

## 11. 핀 생명주기 UX

- **작성**: 코멘트 모드 클릭 → 그 지점에 임시 마커 + 인라인 입력 팝오버 → 본문 입력·저장(POST) → 성공 시 확정 핀 + broadcast. Esc/빈 본문/바깥 클릭=취소.
- **보기**: 마커 클릭 → 팝오버(작성자명·색·본문·작성시각·resolved 상태). resolved 핀은 마커를 **흐리게**(opacity↓) 표시(숨김 아님).
- **수정**: 본인 핀 팝오버의 "수정" → 본문 인라인 편집 → 저장(PATCH body).
- **삭제**: 본인 핀 팝오버의 "삭제" → 확인 → DELETE → 마커 제거 + broadcast.
- **resolved**: 팝오버의 resolved 토글(로그인 누구나) → PATCH resolved → 흐림 상태 갱신 + broadcast.
- 게스트: 팝오버는 읽기 전용(컨트롤 숨김), 코멘트 모드 클릭은 로그인 유도.

## 12. 화면/파일
```
drizzle/schema.ts                         pin_comments + 타입 (수정)
drizzle/migrations/0006_*.sql             테이블 + FK + RLS + index (수동 append)
lib/pins/locate.ts                        콘텐츠좌표+페이지박스 → {pageIndex,xNorm,yNorm}|null (순수·테스트)
lib/pins/types.ts                         PinDTO (createdAt ISO 등 직렬화 형태)
lib/pins/load-pins.ts                     loadPinsForVersion(variantId, versionId) (server)
lib/pins/access.ts (또는 라우트 인라인)    소속·소유권 검증 헬퍼(순수부 테스트)
app/api/p/[publicId]/pins/route.ts        GET·POST
app/api/p/[publicId]/pins/[pinId]/route.ts PATCH·DELETE
lib/access/viewer-gate.ts                 resolveViewerGate에 viewer={id,displayName}|null 추가 (수정)
app/p/[publicId]/layout.tsx               viewer를 셸로 주입 (수정)
app/(auth)/login/page.tsx · actions.ts    returnTo 지원 (수정)
components/realtime/realtime-provider.tsx  pin 브로드캐스트 송수신 (수정)
components/realtime/realtime-shell.tsx     viewer 전달 (수정)
components/preview/public-viewer.tsx       활성 변형의 id/versionId/viewer를 ProposalPreview로 (수정)
components/preview/proposal-preview.tsx    variantId/versionId/viewer/publicId 전달 (수정)
components/preview/canvas-view.tsx         모드 토글 + PinLayer/PinCapture 배선 (수정)
components/preview/pin-layer.tsx           핀 렌더 + 팝오버(보기/수정/삭제/resolved) (신규)
components/preview/pin-capture.tsx         클릭 캡처 + 작성 팝오버 + 로그인 유도 (신규)
lib/preview/types.ts                       PreviewPage에 pageOrder 추가 (수정)
lib/preview/load-variants.ts              pageOrder 포함 (수정)
```

## 13. 보안 요약
- 핀 저장 테이블은 RLS force deny + Drizzle 경유. 모든 읽기/쓰기는 BFF `resolveViewerGate` 통과 후에만.
- `author_id`는 서버 세션에서만 결정 → 작성자 위조 불가. 수정·삭제는 `author_id == 세션id` 재검증 → 타인 핀 변조 불가.
- returnTo는 내부 경로(`/`로 시작, `//`·`/\` 금지)만 허용해 오픈 리다이렉트 차단.
- 공개 채널 broadcast는 ephemeral 반영용이며, 권위는 항상 BFF(테이블)에 있음. 수신 핀 payload는 `id` 가드.

## 14. 테스트
순수 로직 단위 테스트(기존 패턴):
- `lib/pins/locate.ts` — 콘텐츠좌표→페이지 hit-test(페이지 안/경계/여백 밖 null), 정규화 왕복·클램프.
- 소유권/소속 판정 순수부(작성자 일치, version→variant→proposal 소속, page_order 범위).
- returnTo 검증 순수부(내부 경로 허용/오픈 리다이렉트 거부).
I/O·실시간·broadcast·로그인 흐름은 plan의 **2탭 + 로그인/게스트 수동 검증**.

## 15. Done 기준
로그인 사용자가 공개 시안 캔버스에서 코멘트 모드로 특정 페이지 한 지점에 핀을 남기면, 같은 시안을 보는 다른 참여자에게 실시간으로 나타나고 줌/팬에도 그 지점에 붙어 있다. 작성자는 본인 핀을 수정·삭제할 수 있고(타인은 불가, 서버 403), 로그인 사용자는 누구나 resolved를 토글할 수 있다. 게스트는 핀을 보되 코멘트 모드 클릭 시 로그인으로 유도되고, 로그인 후 같은 시안으로 복귀한다. `pin_comments`는 RLS force deny 백스톱을 가진다.

## 16. 작업 형태
`feat/phase5-pins` 브랜치(Stage 2a 머지 후 master 기준, 또는 `feat/phase5-chat` 위에). 태스크별 작은 커밋, 커밋마다 `npx tsc --noEmit` + Vitest 게이트. 캔버스 좌표·로그인·실시간은 2탭 수동 검증. 완료 후 master ff-merge.
