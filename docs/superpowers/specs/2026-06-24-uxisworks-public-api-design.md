# 유시스웍스 공개 API 설계 (`/api/public/*`)

작성일: 2026-06-24

## 배경 / 목표

유시스웍스(포트폴리오/갤러리 사이트)가 cova의 시안 정보를 **읽어가는** 공개 API를 만든다.
[[proposal-exposure-and-tagging-progress]] 설계에서 `exposed_to_uxisworks` 플래그(저장·편집·표시)만
만들고 "외부 publish 파이프라인은 범위 밖"으로 미뤄뒀는데, 이번에 그 파이프라인(**pull 방식 공개 API**)을 구현한다.

유시스웍스가 필요로 하는 것: 포트폴리오용으로 **공개 처리된(노출 토글 ON)** 시안의 정보 +
각 안(variant)의 **최종버전** 이미지.

## 확정된 결정 사항

- **인증 없음 (완전 공개).** `exposed_to_uxisworks = true` 시안만 반환. `visibility`(공개 뷰어 링크)와는
  무관 — 노출 토글이 유일한 게이트.
- **노출 필드**: 제목(`title`), 태그, 작성일(`createdAt`), 최종버전 이미지.
  - **제외**: 참여자(`participants`), Figma 원본 링크(`figmaUrl`) — 내부 정보라 미노출.
- **"최종버전"** = 각 안의 `currentVersionId`가 가리키는 버전(뷰어가 기본 노출하는 현재 버전).
- **구조**: 안(variant)별로 그룹화. 시안 → `variants[]` → 각 안의 최종버전 페이지들.
- **목록은 페이지네이션**으로 전달(`page`/`pageSize`).
- **내부 UUID 미노출**: 외부 식별자는 `publicId`(필수)와 `domain`(슬러그, nullable)만.
  `id`/`variantId`/`versionId`/`pageId`는 응답에 넣지 않는다.
- **캐시 헤더 미적용** (사용자 결정 — `Cache-Control` 등 추가하지 않음).
- 별도 읽기전용 네임스페이스 `/api/public/*` 신설. 기존 `/api/plugin/*` 분리 패턴을 그대로 따른다.

---

## 1. 아키텍처 / 네임스페이스

기존 `/api/plugin/*`(Bearer 전용 외부 표면)와 동일한 발상으로 **읽기전용 공개 표면** `/api/public/*`를
신설한다. 내부 `/api/*`(쿠키 세션·에디터 인가)와 분리해 노출 표면을 한정한다.

- 인가 게이트는 권한이 아니라 **데이터 필터**다: 모든 쿼리가 `exposed_to_uxisworks = true`로 거른다.
  `requireEditor()`를 호출하지 않는다.
- 이미지 URL은 기존 `publicUrl(storagePath)` 재사용([[proposals-bucket-public]] — `proposals` 버킷은 public).

### proxy.ts 변경

`proxy.ts`에 플러그인 분기와 같은 모양의 `/api/public/*` 분기를 **CSRF/쿠키 처리보다 먼저** 추가한다.

```ts
// 읽기전용 공개 표면. 인증 없이 노출(exposed) 시안만 반환한다. 쿠키 자격증명을 받지 않으므로
// 와일드카드 Origin(*)이 안전하다. 읽기 전용이라 메서드는 GET/OPTIONS만 허용.
const PUBLIC_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

if (path.startsWith("/api/public/")) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: PUBLIC_CORS });
  }
  const response = NextResponse.next({ request });
  for (const [key, value] of Object.entries(PUBLIC_CORS)) response.headers.set(key, value);
  return response;
}
```

- 이로써 공개 라우트는 불필요한 supabase 쿠키 세션 처리(`getUser`)도 건너뛴다.
- GET은 기존에도 CSRF 검사 대상이 아니므로 동작 변화는 CORS 헤더 추가뿐이다.

---

## 2. 엔드포인트 & 응답 모양

공통 에러: `{ "error": "CODE" }`. 주요 코드 `NOT_FOUND`(404). 본문 `application/json`.

### 2.1 `GET /api/public/proposals?page=1&pageSize=20`

노출 시안 요약 목록. 정렬: 작성일(`createdAt`) desc, 동률은 `id` desc로 tie-break(`getProposals` 컨벤션).

```json
{
  "items": [
    {
      "publicId": "abc123",
      "domain": "main-renewal",
      "title": "메인 리뉴얼",
      "createdAt": "2026-06-20T08:00:00.000Z",
      "cover": { "url": "https://…/storage/v1/object/public/proposals/…", "width": 1440, "height": 3200 },
      "tags": [
        { "group": "industry", "groupLabel": "산업", "code": "fintech", "label": "핀테크" }
      ]
    }
  ],
  "total": 12,
  "page": 1,
  "pageSize": 20
}
```

- `page` 기본 1(최소 1), `pageSize` 기본 20, **1~100 클램프**.
- `cover` = 첫 번째 안(sortOrder 최상위)의 최종버전 **첫 페이지**(pageOrder 최소). 이미지가 하나도 없으면 `null`.
- `total` = 노출 시안 전체 수(페이지 무관).
- `tags`는 빈 배열 가능.

### 2.2 `GET /api/public/proposals/{publicId}`

노출 시안 단건 상세. 안별 그룹.

```json
{
  "publicId": "abc123",
  "domain": "main-renewal",
  "title": "메인 리뉴얼",
  "createdAt": "2026-06-20T08:00:00.000Z",
  "tags": [
    { "group": "industry", "groupLabel": "산업", "code": "fintech", "label": "핀테크" }
  ],
  "variants": [
    {
      "slug": "a",
      "label": "A",
      "version": { "versionNo": 3, "note": null },
      "pages": [
        { "url": "https://…/storage/v1/object/public/proposals/…", "width": 1440, "height": 3200 }
      ]
    }
  ]
}
```

- `variants`는 `sortOrder` 순.
- 각 안의 `version`은 그 안의 **최종버전**(`currentVersionId`). `pages`는 그 버전의 페이지로 **pageOrder 순**
  (배열 순서 = 표시 순서이므로 `pageOrder` 필드는 응답에 넣지 않는다).
- 최종버전이 없는 빈 안: `version: null`, `pages: []`.
- `{publicId}`가 없거나 노출 OFF → `404 { "error": "NOT_FOUND" }`.

### 2.3 태그 객체 형태

```ts
type PublicTag = {
  group: string;       // tag_groups.code   (안정 키 — 필터링용)
  groupLabel: string;  // tag_groups.label  (표시용)
  code: string;        // tag_options.code  (안정 키)
  label: string;       // tag_options.label (표시용)
};
```

코드(stable key)와 라벨(표시)을 함께 주어 유시스웍스가 필터링·표시 모두 가능하게 한다.
정렬: group `sortOrder` → option `sortOrder`(taxonomy 컨벤션).

---

## 3. 데이터 조회 (FSD 배치)

서버 전용 쿼리 함수(`server-only`). `requireEditor` 미호출, 모두 `exposed_to_uxisworks = true` 필터.

### 3.1 목록 — `src/entities/proposal/api/get-public-proposals.server.ts`

`getPublicProposals(page, pageSize): Promise<Paginated<PublicProposalSummary>>`

1. `total` = `count(*) from proposals where exposed_to_uxisworks = true`.
2. 노출 시안 페이지 조회(정렬 createdAt desc, id desc, limit/offset).
3. **커버 배치 조회**: 이 페이지 시안들에 대해 각 시안의 첫 안(sortOrder 최소)의 `currentVersionId`의
   첫 페이지(pageOrder 최소)를 한 번에 가져온다. (시안별로 1행을 뽑는 조인 — N+1 없음.)
4. **태그 배치 조회**: `getPublicTagsByProposal(proposalIds)`로 한 쿼리에 모아 `Map<proposalId, PublicTag[]>`.
5. 매핑해 `PublicProposalSummary[]` 구성.

### 3.2 상세 — `src/entities/proposal/api/get-public-proposal.server.ts`

`getPublicProposal(publicId): Promise<PublicProposalDetail>`

1. `proposals where public_id = ? and exposed_to_uxisworks = true` 단건. 없으면 `throw new Error("NOT_FOUND")`.
2. 안 목록(sortOrder), 각 안의 `currentVersionId` 버전 메타, 그 버전들의 페이지(pageOrder)를 조회.
   `get-viewer-variants.server.ts`의 조회 골격을 참고하되 **최종버전만** 싣는다(모든 버전 X).
3. 태그(`getPublicTagsByProposal([proposal.id])`).
4. `PublicProposalDetail` 구성.

### 3.3 태그 배치 헬퍼 — `src/entities/tag/api/get-public-tags-by-proposal.server.ts`

`getPublicTagsByProposal(proposalIds: string[]): Promise<Map<string, PublicTag[]>>`

- `proposal_tags`(proposalId in …) → `tag_options`(option_id) → `tag_groups`(group_id) 조인.
- group `sortOrder` → option `sortOrder` 정렬. `proposalId`별로 `PublicTag[]`로 그룹핑.
- `proposalIds`가 비면 빈 Map.

### 3.4 순수 매핑 로직 (테스트 대상)

DB에 의존하지 않는 변환은 작은 순수 함수로 분리해 단위 테스트한다.

- `toPublicTag(row)` — 조인 행 → `PublicTag`.
- `clampPage(page, pageSize)` — `getProposals`의 클램프(1~100, 최소 1)와 동일 규칙. 공유 가능하면 재사용.
- cover 선택은 SQL에서 1행으로 뽑으므로 매핑은 단순(null 처리만).

---

## 4. 타입

`src/entities/proposal/model/public-types.ts` (신규, 공개 계약 전용으로 분리):

```ts
export type PublicTag = { group: string; groupLabel: string; code: string; label: string };

export type PublicPage = { url: string; width: number; height: number };

export type PublicProposalSummary = {
  publicId: string;
  domain: string | null;
  title: string;
  createdAt: string;          // ISO 문자열
  cover: PublicPage | null;
  tags: PublicTag[];
};

export type PublicVariant = {
  slug: string;
  label: string;
  version: { versionNo: number; note: string | null } | null;
  pages: PublicPage[];
};

export type PublicProposalDetail = {
  publicId: string;
  domain: string | null;
  title: string;
  createdAt: string;
  tags: PublicTag[];
  variants: PublicVariant[];
};
```

`Paginated<T>`는 기존 `src/entities/proposal/model/types.ts`의 타입 재사용.
`createdAt`은 JSON 직렬화 시 ISO 문자열로 나가므로 타입도 `string`으로 둔다.

---

## 5. 라우트 핸들러

기존 라우트 컨벤션(try/catch + `toErrorResponse`)을 그대로 따른다.

`app/api/public/proposals/route.ts`:

```ts
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");
    return Response.json(
      await getPublicProposals(
        Number.isFinite(page) ? page : 1,
        Number.isFinite(pageSize) ? pageSize : 20,
      ),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

`app/api/public/proposals/[publicId]/route.ts`:

```ts
export async function GET(_req: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    return Response.json(await getPublicProposal(publicId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

---

## 6. 문서

`docs/uxisworks-public-api.md` 신설(기존 `docs/figma-plugin-api.md` 스타일):

- 네임스페이스 의도(왜 공개·읽기전용·노출 게이트), Base URL, 인증 없음, 에러 포맷.
- 두 엔드포인트의 요청/응답 예시(위 2장 내용).
- "노출되려면 시안 설정에서 유시스웍스 노출 토글 ON" 안내.

---

## 7. 영향 범위 요약

| 파일 | 변경 |
|---|---|
| `proxy.ts` | `/api/public/*` CORS 분기 추가 |
| `app/api/public/proposals/route.ts` | 신규 — 목록 GET |
| `app/api/public/proposals/[publicId]/route.ts` | 신규 — 상세 GET |
| `src/entities/proposal/api/get-public-proposals.server.ts` | 신규 — 목록 쿼리 |
| `src/entities/proposal/api/get-public-proposal.server.ts` | 신규 — 상세 쿼리 |
| `src/entities/tag/api/get-public-tags-by-proposal.server.ts` | 신규 — 태그 배치 조회 |
| `src/entities/proposal/model/public-types.ts` | 신규 — 공개 응답 타입 |
| `docs/uxisworks-public-api.md` | 신규 — 외부 연동 문서 |
| (해당 시 `tests/…`) | 순수 매핑/클램프 단위 테스트 |

---

## 8. 비범위 (YAGNI)

- **인증/API 키** — 완전 공개로 결정. (향후 필요 시 `x-api-key` 헤더로 확장 가능하게 네임스페이스만 분리해둠.)
- **참여자·Figma 링크 노출** — 내부 정보라 제외.
- **쓰기/푸시 동기화** — pull 전용. 노출 ON 시 외부로 push하는 파이프라인/웹훅은 범위 밖.
- **내부 UUID 노출** — `publicId`/`domain`만.
- **레이트리밋·캐시 헤더** — 이번 범위 밖(캐시는 사용자가 명시적으로 제외).
- **모든 버전 노출** — 최종버전만. 버전 히스토리는 제공하지 않음.

---

## 9. 검증 계획

- 타입체크 / lint (기존 무관 실패는 [[repo-verification-gotchas]] 참고해 구분).
- 단위 테스트: 태그 매핑, 페이지 클램프, cover null 처리.
- 수동 E2E (로컬 또는 배포):
  1. 시안 A에 유시스웍스 노출 토글 ON → `GET /api/public/proposals`에 등장, cover·태그·작성일 정상.
  2. 노출 OFF 시안은 목록·상세 모두 안 보임(상세는 404).
  3. `GET /api/public/proposals/{publicId}` → 안별 최종버전 이미지가 sortOrder/pageOrder대로.
  4. 빈 안(최종버전 없음)은 `version: null`, `pages: []`.
  5. 페이지네이션: `pageSize=1`로 페이지 넘기며 `total`/순서 확인. `pageSize` 0/음수/과대값 클램프 확인.
  6. 타 도메인 브라우저에서 fetch → CORS 헤더로 응답 읽힘.
