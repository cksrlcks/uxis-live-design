# cova Figma 플러그인

피그마에서 cova에 로그인하고 시안을 올리고 관리하는 플러그인.
백엔드는 cova의 `/api/plugin/*` (Bearer 토큰 인증) 을 사용한다 →
[연동 스펙](../docs/figma-plugin-api.md).

> **현재 범위: 연결 검증** — 로그인 + 시안 목록 조회까지. 업로드/새 버전/이미지 교체는 다음 단계.

## 구성 (Figma 공식 권장 방식: TypeScript + `tsc`)

| 파일 | 역할 |
|---|---|
| `manifest.json` | 플러그인 정의 (`main`, `ui`, `networkAccess`) |
| `code.ts` → `code.js` | 메인(샌드박스): figma API + 세션 영속화(`clientStorage`) |
| `ui.html` | UI(iframe): 로그인/목록 화면 + 네트워크 요청(`fetch`) |

네트워크 요청은 UI(iframe)에서 한다. iframe은 **null origin** 이라 대상 API가
`Access-Control-Allow-Origin: *` 를 줘야 하는데, cova `/api/plugin/*` 가 그렇게 응답한다.

## 빌드

```bash
cd figma-plugin
npm install
npm run build      # code.ts → code.js (1회)
npm run watch      # 개발 중 자동 컴파일
```

## Figma에 올리기

1. Figma 데스크톱 앱 → 메뉴 → **Plugins → Development → Import plugin from manifest…**
2. `figma-plugin/manifest.json` 선택
3. **Plugins → Development → cova** 실행

## 사용

1. cova 개발 서버 실행 (`npm run dev`, 기본 `http://localhost:3000`).
2. 플러그인 로그인 화면에서 이메일/비밀번호 입력 → 로그인.
3. 로그인되면 내 시안 목록이 보인다. 검색/새로고침 동작 확인 = 연결 검증 완료.
   - 토큰은 메인의 `figma.clientStorage` 에 저장되어 다음 실행에도 유지된다.
   - 편집 권한(`editor`/`admin`)이 없는 계정은 목록이 `FORBIDDEN` 으로 막힌다.

## 메모

- `manifest.json` 의 `networkAccess.allowedDomains` 가 개발 편의상 `"*"` 다.
  **배포 전 실제 운영 도메인으로 좁힐 것.** localhost는 `devAllowedDomains` 로 따로 허용돼 있다.
- `manifest.json` 의 `id` 는 **개발용 임시값**이다. 이 값이 없으면 `figma.clientStorage` 가
  로컬에 저장되지 않아 닫으면 로그인이 풀린다. 퍼블리시 시 Figma가 정식 `id` 를 부여한다.

## 다음 단계

- 선택 프레임 export(`exportAsync`) → 서명 URL 업로드 → 새 시안/새 버전 생성
- 페이지 이미지 교체
