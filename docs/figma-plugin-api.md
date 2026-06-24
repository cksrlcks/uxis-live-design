# Figma 플러그인 연동 API (`/api/plugin/*`)

피그마 플러그인이 cova에 **로그인 → 새 시안 업로드 → 새 버전 추가 → 이미지 교체**를
하기 위한 전용 API. 웹 앱이 쓰는 내부 `/api/*` 와 분리된 네임스페이스다.

## 왜 전용 네임스페이스인가

- 웹 앱은 **HttpOnly 쿠키 세션**으로 인증한다. 플러그인은 샌드박스 iframe(`null`/`figma.com`
  origin)이라 cova 쿠키가 `fetch`에 실리지 않는다 → 쿠키 인증 불가.
- 그래서 플러그인은 **Bearer 액세스 토큰**으로 인증한다. Bearer는 브라우저가 자동으로 싣지
  않는 명시적 자격증명이라 CSRF 위험이 없다.
- `/api/plugin/*` 에만 **CORS 허용 + CSRF(동일 출처) 검사 면제**를 적용한다([proxy.ts](../proxy.ts)).
  내부 `/api/*` 는 기존 동일 출처 보호를 그대로 유지한다 → 노출 표면을 플러그인이 쓰는
  엔드포인트로 한정.
- 인가(에디터 권한)는 각 작업의 `requireEditor()` 가 Bearer 토큰을 검증해 처리한다
  ([guards.server.ts](../src/shared/auth/guards.server.ts)).

## 공통 규칙

- Base URL: `https://<cova-host>`
- 인증: 로그인 외 모든 요청에 헤더 `Authorization: Bearer <accessToken>`
- 요청/응답 본문: `application/json` (업로드 PUT 제외)
- 에러 응답: `{ "error": "CODE" }` (+ Zod 검증 실패 시 `{ "error": "VALIDATION_ERROR", "issues": [...] }`)
  - 주요 코드: `INVALID_CREDENTIALS`(401) · `FORBIDDEN`(403, 에디터 아님) · `NOT_FOUND`(404)
    · `OBJECT_MISSING`(400) · `RATE_LIMITED`(429)
- 이미지 제약: 형식 `image/png` · `image/jpeg` · `image/webp`, 최대 **25MB**/장
  ([constants.ts](../src/shared/lib/proposals/constants.ts))

## 이미지 업로드 3단계 패턴

이미지가 들어가는 모든 작업의 공통 골격:

```
1) 발급:  cova API 가 Supabase Storage 서명 업로드 URL(uploads[].signedUrl, token)을 반환
2) 업로드: 그 URL로 이미지 바이트를 직접 올림 (Supabase Storage, cova 경유 X)
3) 확인:  업로드한 path·width·height 를 cova API 에 보고 → DB 에 페이지 기록
```

- 2단계는 `@supabase/supabase-js` 권장:
  ```ts
  createClient(SUPABASE_URL, PUBLISHABLE_KEY)
    .storage.from("proposals")
    .uploadToSignedUrl(path, token, bytes)
  ```
- `width`/`height` 는 플러그인이 측정해 3단계에 넘긴다. Figma에서는 export한 노드의
  크기(`node.width`/`height`, export scale 반영)에서 바로 얻을 수 있다.

---

## 1. 인증

플러그인은 **외부 브라우저 + 폴링 페어링**으로 로그인한다(샌드박스 iframe은 OAuth 리다이렉트를
되돌려받을 수 없으므로). 흐름:

1. 플러그인이 임의의 `key`(uuid)를 만들어 외부 브라우저로 `https://<cova-host>/plugin-auth?k=<key>` 를 연다.
2. 그 페이지는 미로그인 시 웹 로그인(`/login`, 이메일·구글)으로 보내고, 로그인 후 돌아오면
   세션 토큰을 `key` 로 임시 저장한다(5분 TTL, 1회용).
3. 플러그인은 `POST /api/plugin/auth/poll` 을 `key` 로 폴링해 토큰을 회수한다.

### `POST /api/plugin/auth/poll`
요청 (인증 헤더 불필요):
```json
{ "key": "<플러그인이 만든 uuid>" }
```
응답 `200` — 아직 로그인 전:
```json
{ "status": "pending" }
```
응답 `200` — 로그인 완료(토큰 회수, 해당 key 는 즉시 폐기):
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "v1...",
  "expiresAt": 1750680000,
  "user": { "id": "uuid", "email": "you@example.com", "name": "홍길동", "role": "editor" }
}
```
- 토큰은 `figma.clientStorage` 에 저장. `role !== "editor" && role !== "admin"` 이면 업로드/수정은
  `FORBIDDEN` 이 된다(로그인 자체는 성공).

### `POST /api/plugin/auth/refresh`
액세스 토큰은 수명이 짧다(기본 1h). `expiresAt` 직전에 갱신한다.
```json
{ "refreshToken": "v1..." }
```
응답 `200`: `{ "accessToken", "refreshToken", "expiresAt" }`

---

## 2. 조회 (대상 선택용)

### `GET /api/plugin/proposals?q=&page=1&pageSize=20`
응답 `200`:
```json
{ "items": [{ "id": "uuid", "publicId": "abc123", "title": "...", "domain": null }],
  "total": 42, "page": 1, "pageSize": 20 }
```

### `GET /api/plugin/proposals/{id}`
시안의 안(variant)·버전·페이지 트리. 어떤 안/버전/페이지를 바꿀지 고를 때 사용.
```json
{
  "proposal": { "id": "uuid", "title": "...", "publicId": "abc123", "visibility": "..." },
  "variants": [{
    "id": "variantId", "slug": "a", "label": "A", "currentVersionId": "versionId",
    "versions": [{
      "id": "versionId", "versionNo": 1, "note": null,
      "pages": [{ "id": "pageId", "url": "https://.../public/...", "width": 1440, "height": 3200, "pageOrder": 0 }]
    }]
  }]
}
```

---

## 3. 새 시안 업로드

```
POST /api/plugin/proposals
  body: { "title": "메인 리뉴얼", "files": [{ "contentType": "image/png", "size": 12345 }] }
  → 200: { proposalId, publicId, variantId, versionId,
           uploads: [{ pageId, path, token, signedUrl, pageOrder }] }

[각 파일] uploads[i].signedUrl 로 업로드 (위 2단계)

PUT /api/plugin/proposals/{proposalId}/variants/{variantId}/versions/{versionId}/pages
  body: { "pages": [{ pageId, pageOrder, path, width, height }] }
  → 204
```
- `title` 만 보내고 `files: []` 면 빈 시안만 생성된다(이미지는 이후 새 버전/페이지로 추가).
- 생성 시 안(A)과 버전(1)이 자동으로 만들어지고 응답에 그 `variantId`/`versionId` 가 온다.

---

## 4. 새 버전 추가 ("버전 바꾸기")

기존 시안의 안에 **새 버전을 통째로 올려 최신으로 만든다.** `createVersion` 은 빈 버전을
만들므로, 이미지는 추가(append) 패턴으로 올린다.

```
POST /api/plugin/proposals/{proposalId}/variants/{variantId}/versions
  body: { "note": "2차 시안" }            // note 생략 가능
  → 200: { versionId, versionNo }

POST /api/plugin/proposals/{proposalId}/variants/{variantId}/versions/{versionId}/pages
  body: { "files": [{ contentType, size }] }
  → 200: { versionId, uploads: [{ pageId, path, token, signedUrl, pageOrder }] }

[각 파일] uploads[i].signedUrl 로 업로드

PUT  .../versions/{versionId}/pages
  body: { "pages": [{ pageId, pageOrder, path, width, height }] }
  → 204
```

---

## 5. 올려진 이미지 교체

특정 페이지의 이미지만 새 파일로 교체(이전 객체는 자동 삭제).

```
POST .../versions/{versionId}/pages/{pageId}/replace
  body: { "contentType": "image/png", "size": 12345 }
  → 200: { path, token, signedUrl }

[업로드] signedUrl 로 새 이미지 업로드

PUT  .../versions/{versionId}/pages/{pageId}
  body: { "path", "width", "height" }
  → 204
```

---

## 엔드포인트 요약

| 시나리오 | 메서드 · 경로 |
|---|---|
| 로그인 시작(브라우저) | `GET /plugin-auth?k=<key>` |
| 로그인 폴링 | `POST /api/plugin/auth/poll` |
| 토큰 갱신 | `POST /api/plugin/auth/refresh` |
| 시안 목록 | `GET /api/plugin/proposals` |
| 시안 상세 | `GET /api/plugin/proposals/{id}` |
| 새 시안 생성 | `POST /api/plugin/proposals` |
| 새 안(variant) 생성 | `POST /api/plugin/proposals/{id}/variants` |
| 페이지 확인(생성/추가) | `PUT .../versions/{versionId}/pages` |
| 페이지 업로드 URL 발급 | `POST .../versions/{versionId}/pages` |
| 새 버전 생성 | `POST .../variants/{variantId}/versions` |
| 교체 URL 발급 | `POST .../pages/{pageId}/replace` |
| 교체 확인 | `PUT .../pages/{pageId}` |

> Supabase Storage 도 교차 출처 업로드를 받으므로, Storage CORS 설정에서 플러그인 origin
> (또는 `*`)이 허용돼 있어야 한다(대시보드 기본값에서 보통 허용).
