# cova Figma 플러그인 UI 리팩토링 설계

- 작성일: 2026-06-24
- 대상: `figma-plugin/` (cova 프로젝트 내 Figma 플러그인)
- 레퍼런스: `D:\project\git\figma-preview` (React + TS + Vite 구조)
- 성격: **순수 리팩토링** — UI·스타일·동작 100% 보존, 기능 추가/버그 수정 없음

## 1. 배경 / 문제

현재 플러그인은 두 파일로 구성된다.

- `code.ts` (89줄) — 메인(샌드박스): figma API, 세션 영속(`clientStorage`), PNG export. 비교적 깔끔.
- `ui.html` (**968줄, 43KB 단일 파일**) — 인라인 CSS(~170줄) + 마크업 + **690줄 바닐라 JS**가 모든 책임을 한 파일에:
  테마 감지, postMessage 브릿지, 세션 상태(전역 `var`), 에러 맵, API 클라이언트, export 브릿지,
  업로드 헬퍼, 비즈니스 플로우(새 시안/새 버전/새 안/페이지 교체), 목록·상세·페이지 **명령형 DOM 렌더링**,
  뷰/컨트롤 상태(`updateControls`가 매번 `.needsSel` 재쿼리, `classList.toggle` 산재), 로그인/로그아웃, 이벤트 배선.

문제의 핵심: **단일 모놀리식 파일 + 수동 상태 동기화**. 책임 경계가 없고, 명령형 DOM과 흩어진
`disabled = busy || selectionCount === 0` 동기화 코드가 유지보수를 어렵게 한다.

## 2. 목표 / 비목표

**목표**
- `ui.html`을 레퍼런스(figma-preview)와 동일한 **React + Vite 모듈 구조**로 재구성.
- UI 마크업·CSS·모든 사용자 동작을 **바이트 수준으로 동등**하게 보존.
- UI↔main 메시지를 **단일 타입드 계약**(`src/shared/messages.ts`)으로 공유.
- 명령형 상태 동기화를 React 파생값으로 대체.

**비목표 (이번 작업에서 하지 않음)**
- 새 기능, 동작 변경, 디자인 변경.
- API 엔드포인트/계약 변경, 백엔드 수정.
- `API_BASE` 하드코딩(`http://localhost:3000`), `manifest.id` 임시값 등 기존 TODO성 항목 해결
  (현 상태 그대로 이전. 별도 과제).

## 3. 기술 스택 / 빌드

- React 18 + TypeScript + Vite (레퍼런스와 동일 버전대).
- UI 빌드: `vite-plugin-singlefile`로 JS+CSS를 **단일 self-contained `dist/ui.html`**로 인라인
  (Figma는 외부 스크립트 로드 불가 → 단일 HTML 필수).
- main 빌드: 별도 vite config로 `dist/main.js` (IIFE, ESM 아님).
- 단위 테스트: `vitest` (Vite 네이티브, 경량). 순수 헬퍼에만 적용.

`package.json` 의존성 추가: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`,
`vite-plugin-singlefile`, `@types/react`, `@types/react-dom`, `vitest`.
스크립트: `build:ui`, `build:main`, `build`(둘 다), `dev`(둘 다 watch), `typecheck`, `test`.

## 4. 목표 디렉토리 구조

```
figma-plugin/
├── manifest.json          # main → dist/main.js, ui → dist/ui.html
├── package.json           # deps + 스크립트 정비
├── tsconfig.json          # jsx: react-jsx, bundler 모드
├── vite.config.ts         # UI → 단일 dist/ui.html
├── vite.main.config.ts    # main → dist/main.js (IIFE)
├── index.html             # Vite UI 엔트리 (#root 마운트, 최소 마크업)
├── .gitignore             # dist/ 추가
└── src/
    ├── main.ts            # 기존 code.ts 이전 (샌드박스), shared 타입 import
    ├── shared/
    │   └── messages.ts    # UI ↔ main 타입드 메시지 + ExportedImage
    └── ui/
        ├── main.tsx       # React 엔트리: <App/>, styles.css, 테마 초기화
        ├── App.tsx        # 최상위: 로그인/앱셸 라우팅, 훅 조립
        ├── styles.css     # ui.html <style> 그대로 이관 (디자인 토큰 포함)
        ├── lib/
        │   ├── messaging.ts   # postToMain / onMessageFromMain + export Promise 브릿지
        │   ├── api.ts         # 타입드 cova API 클라이언트 + 서명 URL PUT
        │   ├── errors.ts      # MSG 맵 + humanize
        │   ├── theme.ts       # figma 테마 → dark 클래스 감지
        │   └── upload.ts      # filesMeta / confirmPages / uploadAll
        ├── hooks/
        │   ├── useSession.ts      # config 상태 + persist + login/logout
        │   ├── useFigmaBridge.ts  # selectionCount, export(), notify, openUrl, close
        │   └── useUploadRunner.ts # runUpload(label, fn) + busy + status
        └── components/
            ├── CovaLogo.tsx
            ├── Login.tsx
            ├── Header.tsx
            ├── SelectionBar.tsx
            ├── Tabs.tsx
            ├── StatusBar.tsx
            ├── NewProposalView.tsx
            ├── ExistingView.tsx   # 목록→상세→페이지 내비 조립
            ├── ProposalList.tsx   # + Pager
            ├── VariantList.tsx
            └── PageList.tsx
```

`code.ts`/`code.js`는 `src/main.ts` 이전 후 제거. `dist/`는 빌드 산출물이므로 비커밋
(현재 `code.js`를 무시하는 방식과 동일 철학).

## 5. 메시지 계약 (`src/shared/messages.ts`)

현재 `code.ts`의 `UiMessage`와 `ui.html`의 무타입 핸들러를 단일 타입으로 통합.

```ts
export type ExportedImage = {
  name: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  contentType: string; // "image/png"
};

export type UiToMainMessage =
  | { type: "ready" }
  | { type: "save-session"; session: unknown }
  | { type: "clear-session" }
  | { type: "export-selection" }
  | { type: "open-url"; url: string }
  | { type: "notify"; message: string; error?: boolean }
  | { type: "close" };

export type MainToUiMessage =
  | { type: "init"; session: unknown | null }
  | { type: "selection"; count: number }
  | { type: "export-result"; images: ExportedImage[] }
  | { type: "export-error"; message: string };
```

`main.ts`는 이 타입을 import 하여 `figma.ui.onmessage`/`postMessage`에 적용한다.
main 쪽 로직(선택 필터, `pngSize`, export, clientStorage)은 **현행 그대로** 유지하고
타입 적용 및 모듈 이동만 수행한다.

## 6. UI↔구조 매핑 (무엇이 어디로)

| 현재 ui.html 인라인 | → 이동 위치 |
|---|---|
| 전역 `config/selectionCount/busy/...` + 수동 동기화 | `useSession` · `useFigmaBridge` · `useUploadRunner` + React state |
| `api()` / `tryRefresh()` / 경로 헬퍼(`pagesPath` 등) | `lib/api.ts` |
| `putToSignedUrl/uploadAll/filesMeta/confirmPages` | `lib/upload.ts` |
| `runUpload(label, fn)` | `hooks/useUploadRunner.ts` |
| `MSG` 맵 + `humanize` | `lib/errors.ts` |
| 테마 감지 IIFE(`lum/parse`) | `lib/theme.ts` (`main.tsx`에서 1회 호출) |
| `renderList/renderVariants/renderPages` 명령형 DOM | `ProposalList/VariantList/PageList` JSX |
| `showLogin/showApp/switchTab/switchExistingView` | React 조건부 렌더링 |
| `toMain/onmessage` + `pendingExport` Promise | `lib/messaging.ts` + `useFigmaBridge` |
| `updateControls`(매번 `.needsSel` 재쿼리) | 컴포넌트 파생 `disabled` props |

## 7. API 클라이언트 (`lib/api.ts`)

ui.html의 호출/응답 사용에서 계약을 추출(백엔드 미수정). `createApiClient`는 토큰 접근자와
persist 콜백을 받아 **401 → refresh 1회 재시도**를 보존한다.

```ts
createApiClient({
  baseUrl,                       // "http://localhost:3000"
  getTokens,                     // () => { accessToken, refreshToken }
  setTokens,                     // (t) => void  (refresh 성공 시 persist 포함)
})
```

엔드포인트(인증 필요 표시 *):
- `login(email, password)` → `{ accessToken, refreshToken, expiresAt, user:{name,email,role} }`
- `refresh()`(내부) — `POST /api/plugin/auth/refresh { refreshToken }`
- `listProposals(page, pageSize, q)`* → `{ items:[{id,title,domain,publicId}], total }`
- `getProposal(id)`* → `{ variants:[{id,label,slug,versions[],pages:[{id,url,width,height}],currentVersionId}] }`
- `createProposal(title, files)`* → `{ proposalId, variantId, versionId, uploads[] }`
- `addVariant(pid, files)`* → `{ variantId, versionId, label, uploads[] }`
- `addVersion(pid, vid, note)`* → `{ versionId, versionNo }`
- `issuePages(pid, vid, verId, files)`* → `{ uploads[] }`
- `confirmPages(pid, vid, verId, pages)`* (PUT)
- `replacePageIssue(pid, vid, verId, pageId, {contentType,size})`* → `{ signedUrl, path }`
- `confirmPageReplace(pid, vid, verId, pageId, {path,width,height})`* (PUT)

`uploads[]` 항목: `{ signedUrl, pageId, pageOrder, path }`.
서명 URL PUT은 `lib/upload.ts`의 `putToSignedUrl`(헤더 `content-type`/`cache-control:max-age=3600`/`x-upsert:false`).

**플로우 보존** (현행과 동일):
1. 새 시안: `createProposal` → `uploadAll` → `confirmPages`.
2. 새 버전: `addVersion` → `issuePages` → `uploadAll` → `confirmPages`.
3. 새 안: `addVariant` → `uploadAll` → `confirmPages`.
4. 페이지 교체: `replacePageIssue` → `putToSignedUrl(첫 이미지)` → `confirmPageReplace`.

## 8. 상태 / 컴포넌트 설계

- **App.tsx**: `useSession`/`useFigmaBridge`/`useUploadRunner` 조립. `init` 수신 → 세션 hydrate →
  `isAuthed` 면 앱셸, 아니면 `<Login>`. 탭 상태(`new|existing`) 보유.
- **useSession**: `config` 상태, `isAuthed`, `isEditor`(role editor|admin), `login()`, `logout()`,
  `persist()`(= `save-session` 전송). `clear-session`은 logout에서 사용.
- **useFigmaBridge**: 마운트 시 `ready` 전송, `selection`/`export-result`/`export-error`/`init` 수신.
  `export(): Promise<ExportedImage[]>`(pendingExport ref), `notify/openUrl/close`.
- **useUploadRunner**: `busy` + `status`(text, kind) 관리. `run(label, fn)` = 현행 `runUpload`:
  busy 가드 → export → `fn(images)` → 완료/에러 status + notify.
- **앱셸 컴포넌트**: Header(로고/유저/로그아웃), 권한 경고(roleWarn), SelectionBar, Tabs, StatusBar(상태+"관리화면 열기").
- **NewProposalView**: 제목 입력 + 생성 버튼(`disabled = busy || !has || !title`).
- **ExistingView**: 내부 내비(`list|detail|pages`). `ProposalList`(검색 debounce 300ms, PAGE_SIZE=8 페이저),
  `VariantList`(안 목록, "새 버전"/"새 안 추가"), `PageList`(페이지 목록, "교체"). 각 `needsSel` 버튼은
  `disabled = busy || selectionCount === 0`로 파생.

## 9. CSS / 마크업 보존

- `ui.html <style>` 전체를 `src/ui/styles.css`로 **그대로** 이전(클래스명·토큰·셀렉터 동일).
- Pretendard CDN `<link>`는 `index.html`(Vite 엔트리) `<head>`에 유지.
- cova 로고 SVG 심볼은 `CovaLogo.tsx`로 옮기되 동일 마크업/viewBox 사용.
- 결과 DOM 구조와 클래스가 현행과 일치해야 한다(스타일 회귀 방지).

## 10. 검증 전략

- `npm run typecheck`(`tsc --noEmit`) 통과, `npm run build`(ui+main) 성공.
- **단위 테스트(vitest)** — 순수 헬퍼만:
  - `errors.humanize`(코드→문구, 미지정 코드 fallback)
  - `api` 경로 빌더(`pagesPath/versionsPath/variantsPath`)
  - `upload.filesMeta`/`confirmPages`(매핑 정확성)
  - `theme`의 `parse`/`lum`(hex 3/6자리, rgb 파싱, 임계값)
- **수동 E2E 체크리스트**(Figma 데스크톱, 사람이 실행):
  로그인 · 세션 영속(닫았다 열기) · 401 리프레시 재시도 · 선택 카운트 갱신 ·
  새 시안 생성 · 목록/검색/페이저 · 상세(안 목록) · 새 버전 · 새 안 추가 ·
  페이지 목록/교체 · 로그아웃 · 라이트/다크 테마 · "관리화면 열기".

## 11. manifest / 마이그레이션

- `manifest.json`: `"main": "dist/main.js"`, `"ui": "dist/ui.html"`. `id`·`networkAccess`·`editorType` 불변.
- `README.md` 빌드/구성 섹션을 새 구조에 맞게 갱신.
- 기존 `code.ts`/`code.js` 제거(내용은 `src/main.ts`로).

## 12. 리스크 / 주의

- **동작 드리프트**가 최대 리스크 → 매핑표(6,7,8절)와 E2E 체크리스트로 통제.
- React 전환 시 비동기 플로우(`runUpload` 후 `refreshDetail/refreshPages`) 순서 보존 주의.
- `vite-plugin-singlefile` 단일 HTML 산출 검증(외부 참조 0개) 필수.
- main(IIFE) 빌드가 ESM/`import`를 남기지 않도록 config 확인.
```
