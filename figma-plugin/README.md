# cova Figma 플러그인

피그마에서 cova에 로그인하고 시안을 올리고 관리하는 플러그인.
백엔드는 cova의 `/api/plugin/*` (Bearer 토큰 인증) 을 사용한다 →
[연동 스펙](../docs/figma-plugin-api.md).

> **현재 범위:** 로그인 · 시안 목록 · **새 시안 만들기** · **기존 시안 → 안(A·B) 선택/추가 → 새 버전 올리기**.
> (개별 이미지 교체는 다음 단계.)

## 구성 (React + TypeScript + Vite)

| 파일 | 역할 |
|---|---|
| `manifest.json` | 플러그인 정의 (`main`, `ui`, `networkAccess`) |
| `src/main.ts` → `dist/main.js` | 메인(샌드박스): figma API + 세션 영속(`clientStorage`) |
| `src/shared/messages.ts` | UI ↔ main 메시지 타입 |
| `src/ui/**` → `dist/ui.html` | UI(iframe): React 화면 + 네트워크 요청(`fetch`). 단일 HTML로 인라인 빌드 |

네트워크 요청은 UI(iframe)에서 한다. iframe은 **null origin** 이라 대상 API가
`Access-Control-Allow-Origin: *` 를 줘야 하는데, cova `/api/plugin/*` 가 그렇게 응답한다.

## 빌드

```bash
cd figma-plugin
npm install
npm run build      # dist/ui.html + dist/main.js
npm run dev        # ui/main 동시 watch
npm run test       # 단위 테스트
```

## Figma에 올리기

1. Figma 데스크톱 앱 → 메뉴 → **Plugins → Development → Import plugin from manifest…**
2. `figma-plugin/manifest.json` 선택
3. **Plugins → Development → cova** 실행

## 사용

1. cova 개발 서버 실행 (`npm run dev`, 기본 `http://localhost:3000`).
2. 플러그인 로그인 화면에서 이메일/비밀번호 입력 → 로그인.
   - 토큰은 메인의 `figma.clientStorage` 에 저장되어 다음 실행에도 유지된다.
   - 편집 권한(`editor`/`admin`)이 없는 계정은 업로드가 `FORBIDDEN` 으로 막힌다.
3. Figma 캔버스에서 **프레임을 선택**한다(여러 개 가능 — 선택 순서대로 페이지가 됨).
4. **새 시안** 탭: 제목 입력 → "선택한 프레임으로 새 시안 만들기".
5. **기존 시안에 새 버전** 탭: 시안 검색 → 시안을 누르면 **안(A·B…) 목록**이 열린다.
   - 안 항목의 "새 버전" → 선택 프레임이 그 안의 새 버전으로 올라간다.
   - "＋ 새 안 추가" → 선택 프레임으로 새 안(B, C…)을 만든다(label 자동 부여).
   - 프레임은 1x PNG로 내보낸다. 매우 큰 프레임은 25MB 제한에 걸릴 수 있다.
6. 업로드가 끝나면 하단에 **"관리화면 열기 ↗"** 버튼이 뜬다(`figma.openExternal` 로 해당 시안의
   `/studio/proposals/{id}` 를 브라우저에서 연다).

## 메모

- `manifest.json` 의 `networkAccess.allowedDomains` 가 개발 편의상 `"*"` 다.
  **배포 전 실제 운영 도메인으로 좁힐 것.** localhost는 `devAllowedDomains` 로 따로 허용돼 있다.
- `manifest.json` 의 `id` 는 **개발용 임시값**이다. 이 값이 없으면 `figma.clientStorage` 가
  로컬에 저장되지 않아 닫으면 로그인이 풀린다. 퍼블리시 시 Figma가 정식 `id` 를 부여한다.

## 동작 방식 (업로드)

선택 프레임을 메인이 `exportAsync`(PNG)로 내보내 UI로 전달 → UI가 cova API로 업로드 URL을
발급받아 **Supabase 서명 URL에 직접 PUT** → cova에 페이지 확정. (자세한 엔드포인트는
[연동 스펙](../docs/figma-plugin-api.md).)

## 다음 단계

- 개별 페이지 이미지 교체(특정 페이지만 새 프레임으로)
