# 유시스웍스 공개 API (`/api/public/*`)

유시스웍스(포트폴리오/갤러리)가 cova의 **노출 처리된 시안** 정보를 읽어가는 무인증 읽기전용 API.
웹 앱 내부 `/api/*`(쿠키 세션·에디터 인가)와 분리된 네임스페이스다.

## 공통 규칙

- Base URL: `https://<cova-host>`
- 인증: **없음**. `시안 설정 > 유시스웍스 노출` 토글이 ON인 시안만 반환한다(공개 뷰어 링크
  visibility와는 무관한 별개 축).
- 메서드: `GET`만. CORS는 모든 Origin 허용(`*`).
- 응답 본문: `application/json`
- 에러: `{ "error": "CODE" }` — 주요 코드 `NOT_FOUND`(404, 비노출/부재).
- 식별자: 외부용 `publicId`(필수)·`domain`(슬러그, nullable)만 노출. 내부 UUID는 응답에 없다.
- 이미지: `proposals` public 버킷의 영구 URL. `width`/`height`는 원본 픽셀.

## 1. 목록

### `GET /api/public/proposals?page=1&pageSize=20`

- `page` 기본 1(최소 1), `pageSize` 기본 20(1~100 클램프).
- 정렬: 작성일 desc.
- 각 행 `cover` = 이미지가 있는 첫 안(sortOrder 순)의 최종버전 첫 페이지. 없으면 `null`.

응답 `200`:
```json
{
  "items": [
    {
      "publicId": "abc123",
      "domain": "main-renewal",
      "title": "메인 리뉴얼",
      "createdAt": "2026-06-20T08:00:00.000Z",
      "cover": { "url": "https://.../public/proposals/...", "width": 1440, "height": 3200 },
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

## 2. 상세

### `GET /api/public/proposals/{publicId}`

각 안(variant)의 **최종버전** 이미지를 안별로 그룹화해 반환한다.

응답 `200`:
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
        { "url": "https://.../public/proposals/...", "width": 1440, "height": 3200 }
      ]
    }
  ]
}
```

- `variants`는 sortOrder 순, `pages`는 표시 순서(pageOrder).
- 최종버전이 없는 빈 안: `version: null`, `pages: []`.
- 비노출/없는 `publicId` → `404 { "error": "NOT_FOUND" }`.

## 엔드포인트 요약

| 시나리오 | 메서드 · 경로 |
|---|---|
| 노출 시안 목록 | `GET /api/public/proposals` |
| 노출 시안 상세 | `GET /api/public/proposals/{publicId}` |
