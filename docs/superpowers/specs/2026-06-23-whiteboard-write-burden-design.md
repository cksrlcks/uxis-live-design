# 화이트보드 쓰기 부담 절감 재설계 (로그인 + 사용자별 레이어)

> 작성일: 2026-06-23
> 배경: 화이트보드는 "DB 쓰기 부담"으로 UI를 숨겨 비활성 상태(커밋 d848aa9). 현재 모델은 **획(stroke) 하나 = row 하나**라 그리기마다 INSERT, 특히 **부분 지우개**가 남의 획까지 잘라 조각마다 INSERT + 원본 DELETE를 순차 실행해 쓰기 폭주가 난다.
> 선례: 핀 코멘트(`feat/phase5-pins`)가 **로그인 강제 + 본인 것만 삭제 + 게스트 로그인 유도**를 이미 구현 → 이 패턴을 드로잉에 복제한다.

공개 뷰어 `/p/[publicId]` 캔버스의 화이트보드를 **다시 활성화**하되, DB 쓰기를 최소화한다. 핵심 두 축: ① 드로잉을 **로그인 필수**로 바꿔 모든 획에 안정적 `author_id`를 부여(게스트 임시 신원 문제 제거), ② 저장 단위를 **획 단위 → (사용자 × 페이지) 레이어 단위**로 묶고 **debounce 플러시**로 쓰기 *빈도*를 낮춘다. 지우개는 **본인 획만** 대상으로 하여 cross-user split 폭주를 원천 제거한다.

## 0. 용어
| 용어 | 의미 |
|---|---|
| **획(stroke)** | 펜 다운→업 한 번으로 그려진 정규화 좌표 점열 + 색·굵기. `{ drawId, points, color, width }` |
| **레이어(layer)** | 한 **사용자**가 한 **페이지**에 그린 획들의 묶음 = DB의 row 하나(`strokes` 배열) |
| **뷰어 신원(viewer)** | 인증 세션 프로필 `{ id, displayName }`. 비로그인=null. `resolveViewerGate`가 제공 |
| **플러시(flush)** | 클라가 들고 있는 "내 레이어" 최신 상태를 BFF에 PUT으로 영구화하는 동작(debounce됨) |
| **콘텐츠 좌표** | 캔버스 transform 적용 전 `contentRef` 기준 픽셀 좌표 |

## 1. 범위

**포함**
- `whiteboard_strokes` 테이블을 **(사용자 × variant × version × page) 레이어 단위**로 재정의(라이브 DB 데이터 0건 → 교체)
- 드로잉 **로그인 필수**: 게스트가 펜/그리기 진입 시 핀과 동일한 **로그인 유도 모달 + returnTo**
- 쓰기 경로 재작성: 획마다 즉시 쓰기 → **내 레이어를 debounce로 묶어 PUT 1건** + 탭 숨김 시 즉시 플러시
- 지우개(부분)를 **본인 획만** 대상으로 한정 → cross-user split·다건 쓰기 제거
- 화이트보드 UI **재노출**(현재 숨김 해제)

**제외 (YAGNI)**
- 실시간 broadcast 프로토콜 변경 — 라이브 드로잉·획 단위 송수신은 **그대로 유지**(UX 동일). 변경은 DB 영속 계층에 한정
- 무한 실행취소(undo) 스택, 레이어 잠금/숨김 공유, 도형·텍스트 도구
- 과거 버전 화이트보드(현재 버전만), 게스트 드로잉(로그인으로 대체)
- 테이블 리네임(`whiteboard_strokes` 유지 — 의미만 "획"→"레이어"로 확장)

## 2. 확정된 결정
| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| 1 | 드로잉 권한 | **로그인 필수**(서버 강제) | 사용자 결정("라이브드로잉도 로그인 유도"). 모든 획에 안정적 `author_id` → 소유권·레이어 키 확보, 게스트 임시 신원 불필요 |
| 2 | 저장 단위 | **(사용자 × 페이지) 레이어 = row 하나**, `strokes` jsonb 배열 | 사용자 결정. row 수 최소 + debounce 플러시로 쓰기 빈도 급감 |
| 3 | 지우개 | **부분 지우개 유지하되 본인 획만** | 사용자 결정. 내 레이어 안에서 split → UPDATE 1건. 남의 획 split 폭주 제거 |
| 4 | 쓰기 타이밍 | **~1.5s debounce + visibilitychange/pagehide 시 즉시 플러시** | 쓰기 빈도↓ + 닫기 직전 유실 방지 |
| 5 | 소유권 | **세션 `profile.id` = `author_id`**, 유니크 `(author_id, variant, version, page_order)` | 핀과 동일 모델. 단일 작성자 row라 동시쓰기 충돌 없음(내 row는 나만 씀) |
| 6 | 실시간 | **획 단위 broadcast 유지**(라이브 드로잉 포함) | DB만 묶고 UX·즉시성은 그대로. 권위는 BFF, 재로드 시 GET이 진실 |
| 7 | jsonb 재기록 비용 | **페이지 단위 분할 + debounce로 억제** | append=배열 통째 재기록(TOAST)이나, 페이지로 배열 크기 한정 + 플러시 횟수↓로 상쇄 |
| 8 | 게스트 | **보기 전용 + 로그인 유도**(핀과 동일 모달·returnTo) | 일관 UX, 기존 `/login?returnTo=` 인프라 재사용 |

## 3. 현재 부담의 정체 (왜 바꾸나)
- `onPenUp`([whiteboard-layer.tsx](../../../src/widgets/preview-canvas/ui/whiteboard-layer.tsx)): 펜 뗄 때마다 `createMut.mutate` → **획당 INSERT 1건**.
- `commitErase`(같은 파일): 지우개 경로가 가로지른 **모든 사용자의** 획을 split → **살아남은 조각마다 `createMut.mutateAsync`(INSERT) + 원본 `deleteMut`(DELETE)** 를 `for` 루프에서 순차 await. 드래그 한 번이 획 N개를 지나면 수십 건의 쓰기.
- 결론: 쓰기 *빈도*와 *건수*가 둘 다 폭증 → 서버리스 호출·DB 커넥션 churn 부담. **레이어 단위 + debounce + 본인만**이 세 지점을 동시에 줄인다.

## 4. 데이터 모델 (`drizzle/schema.ts`)
`whiteboard_strokes`를 레이어 단위로 재정의:
```
whiteboard_strokes  (= 사용자별 페이지 드로잉 레이어)
├─ id            uuid PK
├─ proposal_id   uuid → proposals          (ON DELETE CASCADE)
├─ variant_id    uuid → proposal_variants  (ON DELETE CASCADE)
├─ version_id    uuid → proposal_versions  (ON DELETE CASCADE)
├─ page_order    int  NOT NULL
├─ author_id     uuid → profiles(id) NOT NULL (ON DELETE CASCADE) — 로그인 강제·소유권 기준
├─ author_name   text NOT NULL              (표시 스냅샷)
├─ author_color  text NOT NULL              (표시색, cosmetic)
├─ strokes       jsonb NOT NULL             [{ drawId, points:[{x,y}], color, width }, ...]
├─ updated_at    timestamptz NOT NULL default now()
└─ UNIQUE (author_id, variant_id, version_id, page_order)   ← upsert 타깃
   INDEX (variant_id, version_id, page_order)               ← 버전 로드용
```
- 기존 row-level `points/color/width`는 **획 객체 안으로 이동**(획마다 색·굵기가 다를 수 있으므로). row-level엔 작성자 신원만 남는다.
- `author_id`는 **NOT NULL**(게스트 null 폐기) + `ON DELETE CASCADE`(계정 삭제 시 그림 제거).
- RLS `ENABLE` + `FORCE`(정책 없음 = deny). 접근은 Drizzle pooler 경유만(기존 컨벤션 유지).
- 검증 한계: 레이어당 획 수 상한(예: 500), 획당 점 수 `MAX_STROKE_POINTS` 재사용.

## 5. 쓰기 경로 (부담 절감의 핵심)
클라(`WhiteboardLayer`)는 **react-query 캐시의 평탄화된 `StrokeDTO[]`**를 권위 표시 상태로 유지하되, **내 획**(= `authorId === viewer.id`)을 페이지별로 묶어 플러시한다.

- **그리기**: `onPenUp` → 캐시에 내 획 낙관적 추가 + **획 단위 broadcast(즉시)** → 그 페이지를 "dirty"로 마킹하고 **debounce(~1.5s) 후** 해당 페이지의 내 획 전체를 `PUT`(레이어 upsert) 1건.
- **지우기(부분, 본인만)**: 지우개가 **내 획**만 split/제거(남의 획은 hit-test에서 제외) → 캐시 갱신 + 제거 broadcast → 같은 dirty/debounce 경로로 `PUT` 1건.
- **플러시 트리거**: (a) debounce 타이머, (b) `visibilitychange`(hidden)·`pagehide` 시 dirty 페이지 **즉시 플러시**, (c) 언마운트 시 플러시. (b)는 닫기 직전 유실 방지.
- **빈 레이어**: 내 획이 0이 된 페이지는 `PUT { strokes: [] }` → 서버가 내 row 삭제.
- **단일 작성자 보장**: 각 row는 `author_id`로 키잉돼 **나만** 쓴다 → 동시쓰기·lost update 없음. 플러시는 페이지별 순차(in-flight 1개) 보장.

## 6. 실시간 & 렌더 (UX 불변)
- 실시간은 현행 유지: `broadcastDraw`(라이브 중간 점), `broadcastStroke`(확정 획), `broadcastStrokeDeleted`(획 제거), `broadcastDrawEnd`. **프로토콜·핸들러 변경 없음** → 그리는 느낌·즉시성 동일.
- `getStrokes`([get-strokes.server.ts](../../../src/entities/whiteboard/api/get-strokes.server.ts)): 레이어 row들을 읽어 `strokes` 배열을 **평탄화**해 기존 `StrokeDTO[]`(획 단위, 각 획에 row의 `authorId/authorName/authorColor` 부여)로 반환 → **렌더 코드(SVG path) 변경 없음**.
- 렌더 순서: row `updated_at`·배열 인덱스 순(사용자 간 z-order는 비핵심).
- 캐시·구독·SVG 렌더는 그대로. 바뀌는 건 **플러시 뮤테이션**과 **getStrokes 평탄화**, **로그인 게이팅**뿐.

## 7. 로그인 유도 (핀 패턴 복제)
- **게스트 식별**: `WhiteboardContext`에 `viewerId: string | null` 추가(핀의 `pin.viewerId`와 동일 출처 = `resolveViewerGate().viewer.id`). 레이아웃→셸→뷰어→캔버스→`WhiteboardLayer` 경로로 전달(핀과 동일 배선 재사용).
- **게이팅**: `isGuest = viewerId == null`. 게스트가 펜/지우개 진입(또는 첫 `onPenDown`) 시 그리기 대신 **로그인 유도 모달**("그림을 그리려면 로그인이 필요합니다 · [로그인]") → `/login?returnTo=<현재경로+쿼리>`(핀 [pin-layer.tsx:444-468](../../../src/widgets/preview-canvas/ui/pin-layer.tsx#L444-L468)와 동일).
- 게스트는 **보기 전용**: 남이 그린 획은 렌더되지만 펜·지우개 입력은 모달로 분기.

## 8. 접근/권한 모델
뷰 게이트는 `resolveViewerGate`(visibility + unlock 쿠키 + 세션) 재사용. 쓰기는 추가로 세션 검증.

| 동작 | 허용 조건 | 실패 |
|---|---|---|
| 레이어 보기(GET) | `decision === "allow"` | 403 |
| 레이어 저장(PUT) | allow + **세션 존재** | 세션없음 `LOGIN_REQUIRED`(401) / 게이트 403 |
| 소유권 | row는 **세션 `profile.id`로만 upsert** — 남의 레이어 변조 불가(키가 내 id) | — |

- `author_id`·`author_name`은 **항상 서버 세션**에서 취득(`author_name = profile.displayName ?? 이메일 앞부분 ?? "사용자"`, 위조 불가). `author_color`만 클라가 표시색으로 보냄.
- 소속 검증: `variant.proposalId === proposal.id`, `version.variantId === variantId`, `page_order ∈ 그 버전 페이지`. 위반 400.
- 별도 DELETE 엔드포인트 불필요(빈 배열 PUT = 내 레이어 삭제). 타인 레이어는 키 불일치로 애초에 못 건드림.

## 9. BFF API (`app/api/p/[publicId]/strokes/...`)
| 메서드/경로 | 동작 |
|---|---|
| `GET /api/p/[publicId]/strokes?variant=&version=` | 그 버전의 모든 레이어를 **획 단위로 평탄화**한 `{ strokes: StrokeDTO[] }`(현행 응답 형태 유지) |
| `PUT /api/p/[publicId]/strokes` | `{ variantId, versionId, pageOrder, strokes: StrokeInput[], authorColor }` → 세션·소속·한도 검증 → **내 레이어 upsert**(키: 세션 id + page). `strokes:[]`면 내 row 삭제. `{ ok: true }` |
| ~~`POST /strokes`~~ | **제거**(획 단위 생성 폐기) |
| ~~`DELETE /strokes/[strokeId]`~~ | **제거**(라우트 파일 삭제, 빈 PUT으로 대체) |

- 전부 `resolveViewerGate` 게이트. PUT은 `getProfile` 필수(없으면 `LOGIN_REQUIRED`).
- `StrokeInput = { drawId, points, color, width }`(작성자 없음 — 서버가 세션·레이어에서 채움).

## 10. 마이그레이션
- 라이브 DB 화이트보드 데이터 **0건**(메모리 확인) → 파괴적 교체 안전.
- 새 마이그레이션(예: `00NN_whiteboard_layers.sql`): 기존 `whiteboard_strokes` **DROP** 후 §4 형태로 **재생성**(FK·유니크·index·RLS force). Drizzle 컨벤션대로 `db:generate` 후 FK/RLS 수동 점검.

## 11. 영향 받는 파일
```
drizzle/schema.ts                                  whiteboardStrokes 레이어 형태로 재정의 (수정)
drizzle/migrations/00NN_whiteboard_layers.sql      DROP+CREATE+FK+UNIQUE+index+RLS (신규)
src/entities/whiteboard/model/types.ts             StrokeDTO 유지 + StrokeInput 추가 + WhiteboardContext에 viewerId 추가 (수정)
src/entities/whiteboard/model/stroke-schema.ts     입력 스키마를 레이어 upsert로 (수정)
src/entities/whiteboard/api/get-strokes.server.ts  레이어 row → 획 평탄화 (수정)
src/entities/whiteboard/api/stroke.query.ts        그대로(키 동일) (변경 없음 예상)
src/features/whiteboard/api/upsert-layer.server.ts 내 레이어 upsert(세션·소속·한도) (신규, create/delete 대체)
src/features/whiteboard/api/create-stroke.server.ts  제거
src/features/whiteboard/api/delete-stroke.server.ts  제거
src/features/whiteboard/api/use-stroke-mutations.ts  debounce 플러시 훅으로 교체 (수정)
app/api/p/[publicId]/strokes/route.ts              GET + PUT(POST 제거) (수정)
app/api/p/[publicId]/strokes/[strokeId]/route.ts   삭제
src/widgets/preview-canvas/ui/whiteboard-layer.tsx 로그인 게이팅 + 본인만 지우개 + dirty/debounce/pagehide 플러시 + 내 획 그룹핑 (수정)
(레이아웃→셸→뷰어→캔버스)                          WhiteboardContext.viewerId 배선(핀과 동일 경로 재사용) (수정)
화이트보드 UI 재노출 지점(커밋 d848aa9에서 숨긴 곳)  숨김 처리 해제 (수정)
```

## 12. 테스트
순수 로직 단위 테스트(기존 패턴 유지):
- `lib/erase`의 split/intersect — 본인 획만 대상일 때 기대 결과(기존 테스트 보강).
- 평탄화: 레이어 배열 → `StrokeDTO[]`(작성자 필드 부여, 순서) 순수부.
- 소속/한도 검증 순수부(version→variant→proposal, page_order 범위, 획·점 상한).
- 입력 스키마(`StrokeInput`/레이어 upsert) zod 검증.

I/O·실시간·debounce 플러시·로그인 흐름은 plan의 **2탭 + 로그인/게스트 수동 검증**:
- 두 로그인 사용자가 동시에 그릴 때 실시간 반영 + 재로드 후 보존.
- 빠르게 여러 획 → DB 쓰기가 debounce로 묶이는지(네트워크 탭 PUT 횟수).
- 탭 닫기 직전 그린 획이 pagehide 플러시로 보존되는지.
- 본인 획만 지워지고 남의 획은 안 지워지는지.
- 게스트가 펜 클릭 시 로그인 모달 + returnTo 복귀.

## 13. Done 기준
화이트보드가 다시 노출되고, **로그인 사용자만** 그릴 수 있다. 한 사용자가 한 페이지에 여러 획을 빠르게 그려도 DB 쓰기는 **debounce로 소수의 PUT**으로 묶이고(획마다 INSERT 아님), 지우개는 **본인 획만** 잘라 **PUT 1건**으로 끝난다(남의 획 split 폭주 없음). 다른 참여자에게는 실시간으로 동일하게 보이고, 재로드해도 보존된다. 탭을 닫기 직전 그린 획도 pagehide 플러시로 남는다. 게스트는 보기 전용이며 그리기 시도 시 로그인으로 유도되고 로그인 후 같은 화면으로 복귀한다. `whiteboard_strokes`는 RLS force deny 백스톱을 가진다.

## 14. 작업 형태
`feat/whiteboard-layers` 브랜치(master 기준). 태스크별 작은 커밋, 커밋마다 `npx tsc --noEmit` + Vitest 게이트. 마이그레이션·실시간·debounce·로그인은 2탭 수동 검증. 완료 후 master ff-merge.
