# cova Figma 플러그인 UI 리팩토링 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 968줄 모놀리식 `figma-plugin/ui.html`을 레퍼런스(figma-preview)와 동일한 React + Vite 모듈 구조로 재구성하되, UI·스타일·동작을 100% 보존한다.

**Architecture:** Figma는 UI를 단일 self-contained HTML로만 로드하므로 Vite + `vite-plugin-singlefile`로 `dist/ui.html`을 생성한다. 샌드박스(`code.ts`)는 별도 Vite 설정으로 `dist/main.js`(IIFE) 빌드. UI는 순수 로직(api/errors/theme/upload) + 훅(session/figma-bridge/upload-runner) + 프레젠테이션 컴포넌트로 분리하고, UI↔main 메시지는 `src/shared/messages.ts` 단일 타입 계약으로 공유한다.

**Tech Stack:** React 18, TypeScript, Vite 5, @vitejs/plugin-react, vite-plugin-singlefile, vitest. (레퍼런스 `D:\project\git\figma-preview`와 동일 버전대)

## Global Constraints

- **동작·UI·스타일 100% 보존.** 기능 추가/버그 수정/디자인 변경 금지. 의심 시 `figma-plugin/ui.html`(원본)이 진실의 원천.
- **API 계약 불변.** 엔드포인트/요청·응답 형태/헤더를 ui.html 사용 그대로 유지. 백엔드 미수정.
- **하드코딩 보존.** `API_BASE = "http://localhost:3000"`, `PAGE_SIZE = 8`, export `SCALE = 1`, `manifest.id`/`networkAccess` 현행 유지(이번 작업에서 손대지 않음).
- **빌드 산출물 비커밋.** `dist/`는 `.gitignore`. (현재 `code.js` 무시 방식과 동일.)
- **단일 HTML 출력.** `dist/ui.html`은 외부 참조 0개(JS/CSS 전부 인라인)여야 한다.
- **main 출력은 IIFE.** `dist/main.js`에 ESM `import`가 남으면 안 된다.
- **tsconfig strict** + `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch` 켜짐 → 미사용 식별자 금지.
- 모든 경로는 `figma-plugin/` 기준. 모든 명령은 `figma-plugin/`에서 실행.

---

## File Structure

```
figma-plugin/
├── manifest.json              # 수정: main→dist/main.js, ui→dist/ui.html
├── package.json               # 수정: deps + scripts
├── tsconfig.json              # 수정: jsx/bundler/strict
├── vite.config.ts             # 신규: UI 빌드 (singlefile + index→ui 리네임)
├── vite.main.config.ts        # 신규: main 빌드 (IIFE)
├── vitest.config.ts           # 신규: 단위 테스트 (node env)
├── README.md                  # 수정: 새 구조/빌드
├── .gitignore                 # 수정: dist/ 추가
├── code.ts                    # 삭제 (→ src/main.ts)
└── src/
    ├── main.ts                # 신규(이전): 샌드박스
    ├── shared/messages.ts     # 신규: UI↔main 타입드 메시지
    └── ui/
        ├── index.html         # 신규: Vite 엔트리
        ├── vite-env.d.ts      # 신규
        ├── main.tsx           # 신규: React 엔트리 + 테마 + styles.css
        ├── App.tsx            # 신규: 라우팅/조립/플로우 배선
        ├── styles.css         # 신규(이전): ui.html <style> 전체
        ├── config.ts          # 신규: API_BASE, PAGE_SIZE
        ├── lib/
        │   ├── messaging.ts   # postToMain/onMessageFromMain
        │   ├── errors.ts      # MSG/humanize
        │   ├── theme.ts       # applyFigmaTheme + parse/lum
        │   ├── upload.ts      # filesMeta/confirmPages/putToSignedUrl/uploadAll + 타입
        │   └── api.ts         # 경로 빌더 + createApiClient
        ├── hooks/
        │   ├── useSession.ts
        │   ├── useFigmaBridge.ts
        │   └── useUploadRunner.ts
        └── components/
            ├── CovaLogo.tsx
            ├── Login.tsx
            ├── Header.tsx
            ├── SelectionBar.tsx
            ├── Tabs.tsx
            ├── StatusBar.tsx
            ├── NewProposalView.tsx
            ├── ExistingView.tsx
            ├── ProposalList.tsx
            ├── VariantList.tsx
            └── PageList.tsx
```

---

### Task 1: 빌드 스캐폴딩 & 의존성

레퍼런스 `figma-preview`의 Vite/tsconfig 구성을 미러링한다. 이 태스크 끝에서 **빈 React 앱이 단일 HTML로 빌드**되고, 단위 테스트 러너가 동작한다.

**Files:**
- Modify: `figma-plugin/package.json`
- Modify: `figma-plugin/tsconfig.json`
- Modify: `figma-plugin/.gitignore`
- Create: `figma-plugin/vite.config.ts`
- Create: `figma-plugin/vite.main.config.ts`
- Create: `figma-plugin/vitest.config.ts`
- Create: `figma-plugin/src/ui/index.html`
- Create: `figma-plugin/src/ui/vite-env.d.ts`
- Create: `figma-plugin/src/ui/main.tsx` (임시 플레이스홀더 — Task 13에서 최종화)
- Create: `figma-plugin/src/ui/styles.css` (빈 파일 — Task 9에서 채움)

**Interfaces:**
- Produces: `npm run build:ui` → `dist/ui.html`(단일 파일), `npm run build:main` → `dist/main.js`(Task 2 이후), `npm run typecheck`, `npm run test`.

- [ ] **Step 1: `package.json` 교체**

```json
{
  "name": "cova-figma-plugin",
  "version": "0.1.0",
  "private": true,
  "description": "cova 시안 업로드/버전/이미지 교체용 Figma 플러그인",
  "scripts": {
    "build:ui": "vite build",
    "build:main": "vite build --config vite.main.config.ts",
    "build": "npm run build:ui && npm run build:main",
    "dev:ui": "vite build --watch",
    "dev:main": "vite build --config vite.main.config.ts --watch",
    "dev": "npm-run-all --parallel dev:ui dev:main",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@figma/plugin-typings": "^1.100.0",
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "npm-run-all": "^4.1.5",
    "typescript": "^5.6.0",
    "vite": "^5.4.10",
    "vite-plugin-singlefile": "^2.0.3",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: `tsconfig.json` 교체**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["@figma/plugin-typings", "node"]
  },
  "include": ["src", "vite.config.ts", "vite.main.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: `vite.config.ts` 생성 (UI — 단일 HTML)**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    {
      name: 'rename-html-to-ui',
      closeBundle() {
        const from = resolve(__dirname, 'dist/index.html');
        const to = resolve(__dirname, 'dist/ui.html');
        if (existsSync(from)) renameSync(from, to);
      },
    },
  ],
  root: 'src/ui',
  build: {
    outDir: '../../dist',
    emptyOutDir: false,
    target: 'es2017',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
});
```

- [ ] **Step 4: `vite.main.config.ts` 생성 (main — IIFE)**

```ts
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2017',
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      formats: ['iife'],
      name: 'covaPluginMain',
      fileName: () => 'main.js',
    },
    rollupOptions: { output: { extend: true } },
  },
});
```

- [ ] **Step 5: `vitest.config.ts` 생성**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: 엔트리/플레이스홀더 파일 생성**

`src/ui/index.html`:
```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"
    />
    <title>cova</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`src/ui/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`src/ui/styles.css`: (빈 파일)

`src/ui/main.tsx` (임시):
```tsx
import { createRoot } from 'react-dom/client';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('root element missing');
createRoot(container).render(<div>cova</div>);
```

- [ ] **Step 7: `.gitignore`에 `dist/` 추가**

```
node_modules/
dist/
# tsc 산출물 (구버전). 빌드해서 사용.
code.js
```

- [ ] **Step 8: 설치 & 빌드 검증**

Run: `npm install`
Run: `npm run build:ui`
Expected: 성공. `dist/ui.html` 생성. 파일 안에 `<script src=` 또는 `<link href=`로 **로컬 파일을 참조하는 외부 참조가 없음**(Pretendard CDN link만 허용). `node_modules`/`dist` 외 `.gitignore` 무시 확인.

- [ ] **Step 9: 커밋**

```bash
git add figma-plugin/package.json figma-plugin/tsconfig.json figma-plugin/.gitignore figma-plugin/vite.config.ts figma-plugin/vite.main.config.ts figma-plugin/vitest.config.ts figma-plugin/src/ui/index.html figma-plugin/src/ui/vite-env.d.ts figma-plugin/src/ui/main.tsx figma-plugin/src/ui/styles.css figma-plugin/package-lock.json
git commit -m "chore(figma-plugin): scaffold React + Vite build pipeline"
```

---

### Task 2: 공유 메시지 타입 + 샌드박스(main.ts) 이전

`code.ts`를 `src/main.ts`로 옮기고 타입드 메시지를 적용한다. 메인 로직(선택 필터/`pngSize`/export/clientStorage)은 **현행 그대로**.

**Files:**
- Create: `figma-plugin/src/shared/messages.ts`
- Create: `figma-plugin/src/main.ts`
- Delete: `figma-plugin/code.ts`

**Interfaces:**
- Produces: `ExportedImage`, `UiToMainMessage`, `MainToUiMessage` (UI 코드가 import).

- [ ] **Step 1: `src/shared/messages.ts` 생성**

```ts
export type ExportedImage = {
  name: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  contentType: string; // "image/png"
};

export type UiToMainMessage =
  | { type: 'ready' }
  | { type: 'save-session'; session: unknown }
  | { type: 'clear-session' }
  | { type: 'export-selection' }
  | { type: 'open-url'; url: string }
  | { type: 'notify'; message: string; error?: boolean }
  | { type: 'close' };

export type MainToUiMessage =
  | { type: 'init'; session: unknown | null }
  | { type: 'selection'; count: number }
  | { type: 'export-result'; images: ExportedImage[] }
  | { type: 'export-error'; message: string };
```

- [ ] **Step 2: `src/main.ts` 생성 (code.ts 이전 + 타입 적용)**

```ts
// cova Figma 플러그인 — 메인(샌드박스) 코드.
//
// 네트워크 요청은 UI(iframe)에서 수행한다. iframe은 null origin 이라 대상 API가
// `Access-Control-Allow-Origin: *` 를 줘야 하는데, cova `/api/plugin/*` 가 그렇게 응답한다.
// 메인은 figma API(선택 export, clientStorage)만 담당하고 UI와는 postMessage 로만 통신한다.
import type { ExportedImage, MainToUiMessage, UiToMainMessage } from './shared/messages';

const SESSION_KEY = 'cova.session';
const EXPORT_SCALE = 1; // 1x PNG. 아주 큰 프레임은 백엔드 25MB 제한에 걸릴 수 있다.

figma.showUI(__html__, { width: 480, height: 720, themeColors: true });

function postToUi(msg: MainToUiMessage) {
  figma.ui.postMessage(msg);
}

// export 가능한(이미지로 뽑을 수 있는) 선택 노드만 추린다.
function exportableSelection(): SceneNode[] {
  return figma.currentPage.selection.filter((n): n is SceneNode => 'exportAsync' in n);
}

function postSelection() {
  postToUi({ type: 'selection', count: exportableSelection().length });
}
figma.on('selectionchange', postSelection);

// PNG 바이트에서 정확한 픽셀 크기를 읽는다(IHDR: width@16, height@20, big-endian).
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const u32 = (o: number) =>
    ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  return { width: u32(16), height: u32(20) };
}

// 선택된 노드들을 순서대로 PNG 로 내보낸다.
async function exportSelection(): Promise<ExportedImage[]> {
  const images: ExportedImage[] = [];
  for (const node of exportableSelection()) {
    const bytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: EXPORT_SCALE },
    });
    const { width, height } = pngSize(bytes);
    images.push({ name: node.name, bytes, width, height, contentType: 'image/png' });
  }
  return images;
}

figma.ui.onmessage = async (msg: UiToMainMessage) => {
  switch (msg.type) {
    case 'ready': {
      const session = await figma.clientStorage.getAsync(SESSION_KEY);
      postToUi({ type: 'init', session: session ?? null });
      postSelection();
      break;
    }
    case 'save-session':
      await figma.clientStorage.setAsync(SESSION_KEY, msg.session);
      break;
    case 'clear-session':
      await figma.clientStorage.deleteAsync(SESSION_KEY);
      break;
    case 'export-selection': {
      try {
        const images = await exportSelection();
        postToUi({ type: 'export-result', images });
      } catch (e) {
        postToUi({ type: 'export-error', message: e instanceof Error ? e.message : String(e) });
      }
      break;
    }
    case 'open-url':
      figma.openExternal(msg.url);
      break;
    case 'notify':
      figma.notify(msg.message, { error: msg.error });
      break;
    case 'close':
      figma.closePlugin();
      break;
  }
};
```

- [ ] **Step 3: `code.ts` 삭제**

```bash
git rm figma-plugin/code.ts
```

- [ ] **Step 4: 빌드/타입체크 검증**

Run: `npm run build:main`
Expected: 성공. `dist/main.js` 생성, 내부에 `import`/`export` 문 없음(IIFE).
Run: `npm run typecheck`
Expected: 성공(0 errors).

- [ ] **Step 5: 커밋**

```bash
git add figma-plugin/src/shared/messages.ts figma-plugin/src/main.ts
git commit -m "refactor(figma-plugin): move sandbox to src/main.ts with typed messages"
```

---

### Task 3: errors 모듈 (TDD)

**Files:**
- Create: `figma-plugin/src/ui/lib/errors.ts`
- Test: `figma-plugin/src/ui/lib/errors.test.ts`

**Interfaces:**
- Produces: `humanize(code: string): string`

- [ ] **Step 1: 실패 테스트 작성** — `src/ui/lib/errors.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { humanize } from './errors';

describe('humanize', () => {
  it('알려진 코드는 한국어 문구로 변환', () => {
    expect(humanize('FORBIDDEN')).toBe('편집 권한이 없습니다.');
    expect(humanize('NO_SELECTION')).toBe('내보낼 프레임을 먼저 선택하세요.');
  });
  it('미지정 코드는 "오류: <code>" fallback', () => {
    expect(humanize('WAT')).toBe('오류: WAT');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/ui/lib/errors.test.ts`
Expected: FAIL ("Cannot find module './errors'").

- [ ] **Step 3: 구현** — `src/ui/lib/errors.ts` (ui.html 333–348행 이전)

```ts
const MSG: Record<string, string> = {
  NETWORK: '서버에 연결할 수 없습니다. 주소와 포트를 확인하세요.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
  FORBIDDEN: '편집 권한이 없습니다.',
  RATE_LIMITED: '요청이 많습니다. 잠시 후 다시 시도하세요.',
  VALIDATION_ERROR: '입력값을 확인하세요(형식/용량 25MB 초과 등).',
  UPLOAD_FAILED: '이미지 업로드에 실패했습니다.',
  UPLOAD_NETWORK: '이미지 업로드 중 네트워크 오류가 발생했습니다.',
  NO_VARIANT: '이 시안에 안(variant)이 없습니다.',
  NO_SELECTION: '내보낼 프레임을 먼저 선택하세요.',
  EXPORT_FAILED: '프레임 내보내기에 실패했습니다.',
};

export function humanize(code: string): string {
  return MSG[code] || '오류: ' + code;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/ui/lib/errors.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add figma-plugin/src/ui/lib/errors.ts figma-plugin/src/ui/lib/errors.test.ts
git commit -m "refactor(figma-plugin): extract errors.humanize with tests"
```

---

### Task 4: theme 모듈 (TDD)

**Files:**
- Create: `figma-plugin/src/ui/lib/theme.ts`
- Test: `figma-plugin/src/ui/lib/theme.test.ts`

**Interfaces:**
- Produces: `applyFigmaTheme(): void`, `parseColor(c: string): [number,number,number] | null`, `luminance(rgb: [number,number,number]): number`

- [ ] **Step 1: 실패 테스트 작성** — `src/ui/lib/theme.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseColor, luminance } from './theme';

describe('parseColor', () => {
  it('3자리 hex 확장', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
  });
  it('6자리 hex', () => {
    expect(parseColor('#080808')).toEqual([8, 8, 8]);
  });
  it('rgb() 문자열', () => {
    expect(parseColor('rgb(18, 110, 245)')).toEqual([18, 110, 245]);
  });
  it('파싱 불가 시 null', () => {
    expect(parseColor('')).toBeNull();
  });
});

describe('luminance', () => {
  it('밝은 색은 임계값(128) 이상', () => {
    expect(luminance([255, 255, 255])).toBeGreaterThanOrEqual(128);
  });
  it('어두운 색은 임계값 미만', () => {
    expect(luminance([8, 8, 8])).toBeLessThan(128);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/ui/lib/theme.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현** — `src/ui/lib/theme.ts` (ui.html 279–303행 이전)

```ts
export function luminance(rgb: [number, number, number]): number {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
}

export function parseColor(input: string): [number, number, number] | null {
  let c = input.trim();
  if (c.charAt(0) === '#') {
    if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    return [
      parseInt(c.slice(1, 3), 16),
      parseInt(c.slice(3, 5), 16),
      parseInt(c.slice(5, 7), 16),
    ];
  }
  const m = c.match(/\d+/g);
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : null;
}

// Figma 테마(라이트/다크)에 맞춰 서비스 다크 토큰(html.dark)을 적용한다.
export function applyFigmaTheme(): void {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--figma-color-bg');
  const rgb = bg ? parseColor(bg) : null;
  const dark = rgb
    ? luminance(rgb) < 128
    : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/ui/lib/theme.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add figma-plugin/src/ui/lib/theme.ts figma-plugin/src/ui/lib/theme.test.ts
git commit -m "refactor(figma-plugin): extract theme detection with tests"
```

---

### Task 5: upload 모듈 (TDD)

**Files:**
- Create: `figma-plugin/src/ui/lib/upload.ts`
- Test: `figma-plugin/src/ui/lib/upload.test.ts`

**Interfaces:**
- Produces: 타입 `FileMeta`, `Upload`, `ConfirmPage`; 함수 `filesMeta(images)`, `confirmPages(uploads, images)`, `putToSignedUrl(signedUrl, img)`, `uploadAll(uploads, images, onProgress)`.

- [ ] **Step 1: 실패 테스트 작성** — `src/ui/lib/upload.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { filesMeta, confirmPages } from './upload';
import type { ExportedImage } from '../../shared/messages';

function img(w: number, h: number, n = 4): ExportedImage {
  return { name: 'f', bytes: new Uint8Array(n), width: w, height: h, contentType: 'image/png' };
}

describe('filesMeta', () => {
  it('contentType + byteLength 매핑', () => {
    expect(filesMeta([img(10, 20, 7)])).toEqual([{ contentType: 'image/png', size: 7 }]);
  });
});

describe('confirmPages', () => {
  it('uploads와 images를 인덱스로 합쳐 페이지 메타 생성', () => {
    const uploads = [{ signedUrl: 's', pageId: 'p1', pageOrder: 0, path: 'a/b' }];
    expect(confirmPages(uploads, [img(10, 20)])).toEqual([
      { pageId: 'p1', pageOrder: 0, path: 'a/b', width: 10, height: 20 },
    ]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/ui/lib/upload.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현** — `src/ui/lib/upload.ts` (ui.html 418–457행 이전)

```ts
import type { ExportedImage } from '../../shared/messages';

export type FileMeta = { contentType: string; size: number };
export type Upload = { signedUrl: string; pageId: string; pageOrder: number; path: string };
export type ConfirmPage = {
  pageId: string;
  pageOrder: number;
  path: string;
  width: number;
  height: number;
};

export function filesMeta(images: ExportedImage[]): FileMeta[] {
  return images.map((im) => ({ contentType: im.contentType, size: im.bytes.byteLength }));
}

export function confirmPages(uploads: Upload[], images: ExportedImage[]): ConfirmPage[] {
  return uploads.map((u, i) => ({
    pageId: u.pageId,
    pageOrder: u.pageOrder,
    path: u.path,
    width: images[i].width,
    height: images[i].height,
  }));
}

// 이미지를 서명 URL(절대 URL, 토큰 포함)로 Supabase 에 직접 PUT.
export async function putToSignedUrl(signedUrl: string, img: ExportedImage): Promise<void> {
  let res: Response;
  try {
    res = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'content-type': img.contentType,
        'cache-control': 'max-age=3600',
        'x-upsert': 'false',
      },
      body: img.bytes,
    });
  } catch {
    throw new Error('UPLOAD_NETWORK');
  }
  if (!res.ok) throw new Error('UPLOAD_FAILED');
}

export async function uploadAll(
  uploads: Upload[],
  images: ExportedImage[],
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  for (let i = 0; i < uploads.length; i++) {
    onProgress(i + 1, uploads.length);
    await putToSignedUrl(uploads[i].signedUrl, images[i]);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/ui/lib/upload.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add figma-plugin/src/ui/lib/upload.ts figma-plugin/src/ui/lib/upload.test.ts
git commit -m "refactor(figma-plugin): extract upload helpers with tests"
```

---

### Task 6: api 모듈 — 경로 빌더(TDD) + 클라이언트

**Files:**
- Create: `figma-plugin/src/ui/config.ts`
- Create: `figma-plugin/src/ui/lib/api.ts`
- Test: `figma-plugin/src/ui/lib/api.test.ts`

**Interfaces:**
- Consumes: `FileMeta`, `Upload`, `ConfirmPage` (upload.ts).
- Produces: `variantsPath/versionsPath/pagesPath`; `createApiClient(opts): ApiClient`; 응답 타입 `LoginResponse`, `ProposalListResponse`, `ProposalDetail`, `CreateProposalResponse`, `AddVariantResponse`, `AddVersionResponse`, `IssuePagesResponse`, `ReplaceIssueResponse`. `ApiClient` 메서드: `login/listProposals/getProposal/createProposal/addVariant/addVersion/issuePages/confirmPages/replacePageIssue/confirmPageReplace`.

- [ ] **Step 1: 실패 테스트 작성** — `src/ui/lib/api.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { variantsPath, versionsPath, pagesPath } from './api';

describe('path builders', () => {
  it('variantsPath', () => {
    expect(variantsPath('P')).toBe('/api/plugin/proposals/P/variants');
  });
  it('versionsPath', () => {
    expect(versionsPath('P', 'V')).toBe('/api/plugin/proposals/P/variants/V/versions');
  });
  it('pagesPath', () => {
    expect(pagesPath('P', 'V', 'X')).toBe(
      '/api/plugin/proposals/P/variants/V/versions/X/pages',
    );
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/ui/lib/api.test.ts`
Expected: FAIL.

- [ ] **Step 3: `config.ts` 생성**

```ts
// cova 서버 주소. 개발: http://localhost:3000 / 배포 시 운영 도메인으로 변경.
export const API_BASE = 'http://localhost:3000';
export const PAGE_SIZE = 8;
```

- [ ] **Step 4: 구현** — `src/ui/lib/api.ts` (ui.html 349–409행 이전)

```ts
import type { ConfirmPage, FileMeta, Upload } from './upload';

export function variantsPath(pid: string): string {
  return '/api/plugin/proposals/' + pid + '/variants';
}
export function versionsPath(pid: string, vid: string): string {
  return variantsPath(pid) + '/' + vid + '/versions';
}
export function pagesPath(pid: string, vid: string, verId: string): string {
  return versionsPath(pid, vid) + '/' + verId + '/pages';
}

function joinUrl(base: string, path: string): string {
  return String(base).replace(/\/+$/, '') + path;
}

export type User = { name?: string; email?: string; role?: string };
export type Tokens = { accessToken: string | null; refreshToken: string | null };
export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: unknown;
  user: User;
};
export type ProposalListItem = { id: string; title?: string; domain?: string; publicId?: string };
export type ProposalListResponse = { items?: ProposalListItem[]; total?: number };
export type Page = { id: string; url?: string; width?: number; height?: number };
export type Variant = {
  id: string;
  label?: string;
  slug?: string;
  versions?: unknown[];
  pages?: Page[];
  currentVersionId?: string;
};
export type ProposalDetail = { variants?: Variant[] };
export type CreateProposalResponse = {
  proposalId: string;
  variantId: string;
  versionId: string;
  uploads: Upload[];
};
export type AddVariantResponse = {
  variantId: string;
  versionId: string;
  label: string;
  uploads: Upload[];
};
export type AddVersionResponse = { versionId: string; versionNo: number };
export type IssuePagesResponse = { uploads: Upload[] };
export type ReplaceIssueResponse = { signedUrl: string; path: string };

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(opts: {
  baseUrl: string;
  getTokens: () => Tokens;
  onTokens: (t: { accessToken: string; refreshToken: string; expiresAt: unknown }) => void;
}) {
  const { baseUrl } = opts;

  async function tryRefresh(): Promise<boolean> {
    const { refreshToken } = opts.getTokens();
    if (!refreshToken) return false;
    try {
      const res = await fetch(joinUrl(baseUrl, '/api/plugin/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const j = await res.json();
      opts.onTokens({ accessToken: j.accessToken, refreshToken: j.refreshToken, expiresAt: j.expiresAt });
      return true;
    } catch {
      return false;
    }
  }

  async function request<T>(
    path: string,
    init: { method?: string; body?: string; headers?: Record<string, string> } = {},
    auth = false,
    retried = false,
  ): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const { accessToken } = opts.getTokens();
    if (auth && accessToken) headers['Authorization'] = 'Bearer ' + accessToken;
    if (init.headers) Object.assign(headers, init.headers);

    let res: Response;
    try {
      res = await fetch(joinUrl(baseUrl, path), {
        method: init.method || 'GET',
        headers,
        body: init.body,
      });
    } catch {
      throw new Error('NETWORK');
    }
    // 액세스 토큰 만료(401) → 리프레시 후 1회 재시도.
    if (res.status === 401 && auth && !retried) {
      if (await tryRefresh()) return request<T>(path, init, auth, true);
    }
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok) throw new Error((body && body.error) || 'HTTP_' + res.status);
    return body as T;
  }

  return {
    login: (email: string, password: string) =>
      request<LoginResponse>('/api/plugin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    listProposals: (page: number, pageSize: number, q: string) =>
      request<ProposalListResponse>(
        '/api/plugin/proposals?page=' + page + '&pageSize=' + pageSize + '&q=' + encodeURIComponent(q),
        {},
        true,
      ),
    getProposal: (id: string) =>
      request<ProposalDetail>('/api/plugin/proposals/' + id, {}, true),
    createProposal: (title: string, files: FileMeta[]) =>
      request<CreateProposalResponse>(
        '/api/plugin/proposals',
        { method: 'POST', body: JSON.stringify({ title, files }) },
        true,
      ),
    addVariant: (pid: string, files: FileMeta[]) =>
      request<AddVariantResponse>(
        variantsPath(pid),
        { method: 'POST', body: JSON.stringify({ files }) },
        true,
      ),
    addVersion: (pid: string, vid: string, note: string) =>
      request<AddVersionResponse>(
        versionsPath(pid, vid),
        { method: 'POST', body: JSON.stringify({ note }) },
        true,
      ),
    issuePages: (pid: string, vid: string, verId: string, files: FileMeta[]) =>
      request<IssuePagesResponse>(
        pagesPath(pid, vid, verId),
        { method: 'POST', body: JSON.stringify({ files }) },
        true,
      ),
    confirmPages: (pid: string, vid: string, verId: string, pages: ConfirmPage[]) =>
      request<unknown>(
        pagesPath(pid, vid, verId),
        { method: 'PUT', body: JSON.stringify({ pages }) },
        true,
      ),
    replacePageIssue: (
      pid: string,
      vid: string,
      verId: string,
      pageId: string,
      meta: { contentType: string; size: number },
    ) =>
      request<ReplaceIssueResponse>(
        pagesPath(pid, vid, verId) + '/' + pageId + '/replace',
        { method: 'POST', body: JSON.stringify(meta) },
        true,
      ),
    confirmPageReplace: (
      pid: string,
      vid: string,
      verId: string,
      pageId: string,
      meta: { path: string; width: number; height: number },
    ) =>
      request<unknown>(
        pagesPath(pid, vid, verId) + '/' + pageId,
        { method: 'PUT', body: JSON.stringify(meta) },
        true,
      ),
  };
}
```

- [ ] **Step 5: 테스트 통과 + 타입체크**

Run: `npx vitest run src/ui/lib/api.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: 성공.

- [ ] **Step 6: 커밋**

```bash
git add figma-plugin/src/ui/config.ts figma-plugin/src/ui/lib/api.ts figma-plugin/src/ui/lib/api.test.ts
git commit -m "refactor(figma-plugin): extract typed api client with path-builder tests"
```

---

### Task 7: messaging 모듈

**Files:**
- Create: `figma-plugin/src/ui/lib/messaging.ts`

**Interfaces:**
- Consumes: `MainToUiMessage`, `UiToMainMessage`.
- Produces: `postToMain(msg)`, `onMessageFromMain(handler): () => void`.

- [ ] **Step 1: 구현** — `src/ui/lib/messaging.ts` (ui.html 306–308, 941–962행 이전)

```ts
import type { MainToUiMessage, UiToMainMessage } from '../../shared/messages';

export function postToMain(msg: UiToMainMessage): void {
  parent.postMessage({ pluginMessage: msg }, '*');
}

export function onMessageFromMain(handler: (msg: MainToUiMessage) => void): () => void {
  const listener = (event: MessageEvent) => {
    const msg = event.data?.pluginMessage as MainToUiMessage | undefined;
    if (!msg) return;
    handler(msg);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck`
Expected: 성공.

- [ ] **Step 3: 커밋**

```bash
git add figma-plugin/src/ui/lib/messaging.ts
git commit -m "refactor(figma-plugin): extract postMessage bridge"
```

---

### Task 8: 훅 (useSession, useFigmaBridge, useUploadRunner)

**Files:**
- Create: `figma-plugin/src/ui/hooks/useSession.ts`
- Create: `figma-plugin/src/ui/hooks/useFigmaBridge.ts`
- Create: `figma-plugin/src/ui/hooks/useUploadRunner.ts`

**Interfaces:**
- Consumes: `messaging`, `errors.humanize`, `api.Tokens/User`, `ExportedImage`.
- Produces:
  - `useSession()` → `{ config, isAuthed, isEditor, getTokens, setTokens, setSession, hydrate, logout }`
  - `SessionConfig = { accessToken: string|null; refreshToken: string|null; expiresAt: unknown; user: User|null }`
  - `useFigmaBridge(onInit)` → `{ selectionCount, exportSelection, notify, openUrl, close }`
  - `useUploadRunner({ exportSelection, notify, onBeforeRun })` → `{ busy, status, setStatus, setStatusOk, run }`
  - `Status = { text: string; kind: '' | 'err' | 'ok' }`
  - `run(label, fn)` 의 `fn: (images, setStatus) => Promise<void>`

- [ ] **Step 1: `useSession.ts` 구현** (ui.html 316–320, 842–886행 로직 이전)

```ts
import { useCallback, useRef, useState } from 'react';
import { postToMain } from '../lib/messaging';
import type { Tokens, User } from '../lib/api';

export type SessionConfig = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: unknown;
  user: User | null;
};

const EMPTY: SessionConfig = { accessToken: null, refreshToken: null, expiresAt: null, user: null };

export function useSession() {
  const [config, setConfig] = useState<SessionConfig>(EMPTY);
  const ref = useRef(config);
  ref.current = config;

  const persist = useCallback((next: SessionConfig) => {
    postToMain({ type: 'save-session', session: next });
  }, []);

  // init 수신 시: 저장된 세션을 현재 config에 머지.
  const hydrate = useCallback((session: unknown | null) => {
    if (session) setConfig((prev) => ({ ...prev, ...(session as Partial<SessionConfig>) }));
  }, []);

  // 로그인 성공: 전체 세션 교체 + persist.
  const setSession = useCallback(
    (next: SessionConfig) => {
      setConfig(next);
      persist(next);
    },
    [persist],
  );

  // 401 리프레시 성공: 토큰만 갱신 + persist.
  const setTokens = useCallback(
    (t: { accessToken: string; refreshToken: string; expiresAt: unknown }) => {
      setConfig((prev) => {
        const next = { ...prev, ...t };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const logout = useCallback(() => {
    setConfig(EMPTY);
    postToMain({ type: 'clear-session' });
  }, []);

  // api 클라이언트가 항상 최신 토큰을 읽도록 ref 기반 getter.
  const getTokens = useCallback(
    (): Tokens => ({ accessToken: ref.current.accessToken, refreshToken: ref.current.refreshToken }),
    [],
  );

  const isAuthed = !!(config.accessToken && config.user);
  const isEditor = config.user?.role === 'editor' || config.user?.role === 'admin';

  return { config, isAuthed, isEditor, getTokens, setTokens, setSession, hydrate, logout };
}
```

- [ ] **Step 2: `useFigmaBridge.ts` 구현** (ui.html 411–417, 940–965행 로직 이전)

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExportedImage } from '../../shared/messages';
import { onMessageFromMain, postToMain } from '../lib/messaging';

export function useFigmaBridge(onInit: (session: unknown | null) => void) {
  const [selectionCount, setSelectionCount] = useState(0);
  const pending = useRef<{ resolve: (i: ExportedImage[]) => void; reject: (e: Error) => void } | null>(
    null,
  );
  const onInitRef = useRef(onInit);
  onInitRef.current = onInit;

  useEffect(() => {
    const off = onMessageFromMain((msg) => {
      if (msg.type === 'init') {
        onInitRef.current(msg.session);
      } else if (msg.type === 'selection') {
        setSelectionCount(msg.count || 0);
      } else if (msg.type === 'export-result') {
        pending.current?.resolve(msg.images || []);
        pending.current = null;
      } else if (msg.type === 'export-error') {
        pending.current?.reject(new Error('EXPORT_FAILED'));
        pending.current = null;
      }
    });
    // 핸들러 등록이 끝났으니 메인에 저장된 세션을 요청한다(race 방지 pull).
    postToMain({ type: 'ready' });
    return off;
  }, []);

  const exportSelection = useCallback(
    () =>
      new Promise<ExportedImage[]>((resolve, reject) => {
        pending.current = { resolve, reject };
        postToMain({ type: 'export-selection' });
      }),
    [],
  );

  const notify = useCallback(
    (message: string, error?: boolean) => postToMain({ type: 'notify', message, error }),
    [],
  );
  const openUrl = useCallback((url: string) => postToMain({ type: 'open-url', url }), []);
  const close = useCallback(() => postToMain({ type: 'close' }), []);

  return { selectionCount, exportSelection, notify, openUrl, close };
}
```

- [ ] **Step 3: `useUploadRunner.ts` 구현** (ui.html 459–478행 `runUpload` + 813–822 status 이전)

```ts
import { useCallback, useRef, useState } from 'react';
import type { ExportedImage } from '../../shared/messages';
import { humanize } from '../lib/errors';

export type Status = { text: string; kind: '' | 'err' | 'ok' };
export type SetStatus = (text: string, isErr?: boolean) => void;

export function useUploadRunner(opts: {
  exportSelection: () => Promise<ExportedImage[]>;
  notify: (message: string, error?: boolean) => void;
  onBeforeRun?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatusState] = useState<Status>({ text: '', kind: '' });
  const busyRef = useRef(false);

  const setStatus = useCallback<SetStatus>(
    (text, isErr) => setStatusState({ text: text || '', kind: isErr ? 'err' : '' }),
    [],
  );
  const setStatusOk = useCallback((text: string) => setStatusState({ text, kind: 'ok' }), []);

  const run = useCallback(
    async (label: string, fn: (images: ExportedImage[], setStatus: SetStatus) => Promise<void>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      opts.onBeforeRun?.();
      setStatus(label + ' — 프레임 내보내는 중…');
      try {
        const images = await opts.exportSelection();
        if (!images.length) throw new Error('NO_SELECTION');
        await fn(images, setStatus);
        setStatusOk(label + ' 완료 ✓');
      } catch (e) {
        const m = humanize(e instanceof Error ? e.message : String(e));
        setStatus(m, true);
        opts.notify(m, true);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [opts, setStatus, setStatusOk],
  );

  return { busy, status, setStatus, setStatusOk, run };
}
```

- [ ] **Step 4: 타입체크**

Run: `npm run typecheck`
Expected: 성공.

- [ ] **Step 5: 커밋**

```bash
git add figma-plugin/src/ui/hooks
git commit -m "refactor(figma-plugin): add session/bridge/upload-runner hooks"
```

---

### Task 9: styles.css 이전 + 로고 컴포넌트

ui.html `<style>`(9–177행) 전체를 `styles.css`로 **그대로** 옮긴다(셀렉터/토큰/값 동일). cova 로고 SVG 심볼(180–188행)을 컴포넌트화.

**Files:**
- Modify: `figma-plugin/src/ui/styles.css`
- Create: `figma-plugin/src/ui/components/CovaLogo.tsx`

**Interfaces:**
- Produces: `<CovaLogoSymbol />`(숨김 `<symbol>` 정의), `<CovaLogo width height className />`(`<use>` 참조).

- [ ] **Step 1: `styles.css` 채우기** — ui.html 10–177행의 CSS를 **문자 그대로** 복사(주석 `/* cova 서비스 디자인 토큰 (globals.css) */`부터 `.status.ok {...}`까지). 클래스명/값 변경 금지.

- [ ] **Step 2: `CovaLogo.tsx` 생성** (ui.html 180–188행의 symbol + 193/213행의 use)

```tsx
// cova 로고(워드마크). Symbol 1회 정의 후 여러 곳에서 <use>로 참조.
export function CovaLogoSymbol() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <symbol id="covaLogo" viewBox="0 0 103 25">
        <path d="M89.8351 25C86.3624 25 83.4579 23.8208 81.1217 21.4623C78.8171 19.0723 77.6648 16.0849 77.6648 12.5C77.6648 8.88365 78.8645 5.89623 81.2638 3.53774C83.6947 1.17925 86.7413 0 90.4034 0C94.034 0 97.0332 1.16352 99.4009 3.49057C101.8 5.81761 103 8.74214 103 12.2642V24.5283H98.5486V20.2358C97.6014 21.7138 96.3386 22.8774 94.7601 23.7264C93.2132 24.5755 91.5715 25 89.8351 25ZM98.1697 12.5C98.1697 10.2358 97.4278 8.34906 95.944 6.83962C94.4602 5.33019 92.5818 4.57547 90.3087 4.57547C88.0672 4.57547 86.2046 5.33019 84.7208 6.83962C83.237 8.34906 82.495 10.2358 82.495 12.5C82.495 14.7956 83.237 16.6981 84.7208 18.2075C86.2046 19.6855 88.0672 20.4245 90.3087 20.4245C92.5818 20.4245 94.4602 19.6855 95.944 18.2075C97.4278 16.6981 98.1697 14.7956 98.1697 12.5Z" fill="currentColor" />
        <path d="M68.769 21.5095C68.2639 22.7673 67.6956 23.6321 67.0642 24.1038C66.4328 24.5441 65.6277 24.7642 64.6491 24.7642C63.6704 24.7642 62.8496 24.5283 62.1866 24.0566C61.5236 23.585 60.9711 22.7359 60.5291 21.5095L52.1946 0.471741H57.309L64.2702 19.2453C64.3649 19.4969 64.5228 19.6227 64.7438 19.6227C64.9332 19.6227 65.0753 19.4969 65.17 19.2453L71.9892 0.471741H77.0088L68.769 21.5095Z" fill="currentColor" />
        <path d="M47.9921 21.5094C45.6244 23.8365 42.6094 25 38.9473 25C35.2851 25 32.2543 23.8365 29.855 21.5094C27.4872 19.1509 26.3033 16.1478 26.3033 12.5C26.3033 8.88365 27.4872 5.89623 29.855 3.53774C32.2543 1.17925 35.2851 0 38.9473 0C42.6094 0 45.6244 1.17925 47.9921 3.53774C50.3915 5.89623 51.5912 8.88365 51.5912 12.5C51.5912 16.1478 50.3915 19.1509 47.9921 21.5094ZM33.312 18.2075C34.7958 19.6855 36.6742 20.4245 38.9473 20.4245C41.2203 20.4245 43.083 19.6855 44.5352 18.2075C46.019 16.6981 46.7609 14.7956 46.7609 12.5C46.7609 10.2044 46.019 8.31761 44.5352 6.83962C43.083 5.33019 41.2203 4.57547 38.9473 4.57547C36.6742 4.57547 34.7958 5.33019 33.312 6.83962C31.8597 8.31761 31.1336 10.2044 31.1336 12.5C31.1336 14.7956 31.8597 16.6981 33.312 18.2075Z" fill="currentColor" />
        <path d="M24.3407 15.7075C23.7093 18.5063 22.3202 20.7547 20.1734 22.4528C18.0266 24.1509 15.4379 25 12.4071 25C8.83969 25 5.87208 23.8208 3.5043 21.4623C1.1681 19.1038 0 16.1164 0 12.5C0 8.88365 1.1681 5.89623 3.5043 3.53774C5.87208 1.17925 8.83969 0 12.4071 0C15.4379 0 18.0266 0.864781 20.1734 2.59434C22.3518 4.29245 23.7409 6.54088 24.3407 9.33962H19.3684C18.8317 7.89308 17.9477 6.74528 16.7165 5.89623C15.4852 5.01572 14.0488 4.57547 12.4071 4.57547C10.2288 4.57547 8.41349 5.33019 6.96125 6.83962C5.54059 8.34906 4.83026 10.2358 4.83026 12.5C4.83026 14.7956 5.54059 16.6981 6.96125 18.2075C8.38192 19.6855 10.1972 20.4245 12.4071 20.4245C14.0172 20.4245 15.4379 20 16.6691 19.1509C17.9319 18.2704 18.8317 17.1226 19.3684 15.7075H24.3407Z" fill="currentColor" />
      </symbol>
    </svg>
  );
}

export function CovaLogo({
  width,
  height,
  className,
}: {
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 103 25" width={width} height={height}>
      <use href="#covaLogo" />
    </svg>
  );
}
```

- [ ] **Step 3: 타입체크**

Run: `npm run typecheck`
Expected: 성공.

- [ ] **Step 4: 커밋**

```bash
git add figma-plugin/src/ui/styles.css figma-plugin/src/ui/components/CovaLogo.tsx
git commit -m "refactor(figma-plugin): port styles.css verbatim + CovaLogo component"
```

---

### Task 10: 프레젠테이션 컴포넌트 (Login, Header, SelectionBar, Tabs, StatusBar)

상태 없는(또는 자체 입력 상태만 가진) 셸 컴포넌트들. 마크업/클래스는 ui.html과 동일.

**Files:**
- Create: `figma-plugin/src/ui/components/Login.tsx`
- Create: `figma-plugin/src/ui/components/Header.tsx`
- Create: `figma-plugin/src/ui/components/SelectionBar.tsx`
- Create: `figma-plugin/src/ui/components/Tabs.tsx`
- Create: `figma-plugin/src/ui/components/StatusBar.tsx`

**Interfaces:**
- Produces:
  - `<Login onSubmit(email,password) busy errorText onSignup />`
  - `<Header user onLogout />`  (`user: { name?, email? }`)
  - `<SelectionBar count />`
  - `<Tabs tab onChange />`  (`tab: 'new'|'existing'`)
  - `<StatusBar status openVisible onOpen />`  (`status: Status`)

- [ ] **Step 1: `Login.tsx`** (ui.html 191–208행 + doLogin 842–869행)

```tsx
import { useState } from 'react';
import { CovaLogo } from './CovaLogo';

export function Login({
  busy,
  errorText,
  onSubmit,
  onSignup,
}: {
  busy: boolean;
  errorText: string;
  onSubmit: (email: string, password: string) => void;
  onSignup: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => onSubmit(email.trim(), password);

  return (
    <section id="login">
      <div className="loginbody">
        <CovaLogo className="logo login-logo" width={106} height={26} />
        <h1 className="login-title">로그인</h1>
        <p className="login-sub">가입하신 이메일로 로그인해주세요</p>

        <label htmlFor="email">이메일</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="6자 이상"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />

        <button id="loginBtn" type="button" disabled={busy} onClick={submit}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
        <div className="err" id="loginErr">
          {errorText}
        </div>

        <div className="signup">
          계정이 없으신가요?{' '}
          <a
            id="signupLink"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onSignup();
            }}
          >
            회원가입
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `Header.tsx`** (ui.html 212–219행)

```tsx
import { CovaLogo } from './CovaLogo';

export function Header({
  user,
  onLogout,
}: {
  user: { name?: string; email?: string };
  onLogout: () => void;
}) {
  return (
    <header>
      <CovaLogo className="logo" width={66} height={16} />
      <div className="who">
        <div className="name" id="userName">
          {user.name || ''}
        </div>
        <div className="email" id="userEmail">
          {user.email ? '(' + user.email + ')' : ''}
        </div>
      </div>
      <button className="soft sm" id="logoutBtn" type="button" onClick={onLogout}>
        로그아웃
      </button>
    </header>
  );
}
```

- [ ] **Step 3: `SelectionBar.tsx`** (ui.html 222행 + updateControls 803–808행)

```tsx
export function SelectionBar({ count }: { count: number }) {
  const has = count > 0;
  return (
    <div className={'selbar' + (has ? ' has' : '')} id="selbar">
      {has ? '선택된 프레임: ' + count + '개' : 'Figma에서 올릴 프레임을 선택하세요'}
    </div>
  );
}
```

- [ ] **Step 4: `Tabs.tsx`** (ui.html 224–227행 + switchTab 830–839행)

```tsx
export function Tabs({
  tab,
  onChange,
}: {
  tab: 'new' | 'existing';
  onChange: (tab: 'new' | 'existing') => void;
}) {
  return (
    <div className="tabs">
      <button
        id="tabNewBtn"
        type="button"
        className={tab === 'new' ? 'active' : ''}
        onClick={() => onChange('new')}
      >
        새 시안
      </button>
      <button
        id="tabExistingBtn"
        type="button"
        className={tab === 'existing' ? 'active' : ''}
        onClick={() => onChange('existing')}
      >
        기존 시안
      </button>
    </div>
  );
}
```

- [ ] **Step 5: `StatusBar.tsx`** (ui.html 272–275행 + setStatus/showOpen 813–829행)

```tsx
import type { Status } from '../hooks/useUploadRunner';

export function StatusBar({
  status,
  openVisible,
  onOpen,
}: {
  status: Status;
  openVisible: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="statusbar">
      <div className={'status' + (status.kind ? ' ' + status.kind : '')} id="status">
        {status.text}
      </div>
      <button
        className={'sm' + (openVisible ? '' : ' hidden')}
        id="openBtn"
        type="button"
        onClick={onOpen}
      >
        관리화면 열기 ↗
      </button>
    </div>
  );
}
```

- [ ] **Step 6: 타입체크 + 커밋**

Run: `npm run typecheck`
Expected: 성공.

```bash
git add figma-plugin/src/ui/components/Login.tsx figma-plugin/src/ui/components/Header.tsx figma-plugin/src/ui/components/SelectionBar.tsx figma-plugin/src/ui/components/Tabs.tsx figma-plugin/src/ui/components/StatusBar.tsx
git commit -m "refactor(figma-plugin): add shell presentation components"
```

---

### Task 11: NewProposalView + 목록/안/페이지 리스트 컴포넌트

`viewNew`와, 기존 시안 화면의 3개 리스트 렌더러(목록/안/페이지)를 JSX로. 명령형 `renderList/renderVariants/renderPages`를 대체.

**Files:**
- Create: `figma-plugin/src/ui/components/NewProposalView.tsx`
- Create: `figma-plugin/src/ui/components/ProposalList.tsx`
- Create: `figma-plugin/src/ui/components/VariantList.tsx`
- Create: `figma-plugin/src/ui/components/PageList.tsx`

**Interfaces:**
- Consumes: `ProposalListItem`, `Variant`, `Page` (api.ts).
- Produces:
  - `<NewProposalView busy selectionCount onCreate(title) />` — 내부 title 상태 보유, 생성 후 비우기 위해 `createKey`(number) prop으로 리셋.
  - `<ProposalList items total page pageSize loading errorText onOpen(id,title) onSearch(q) onRefresh onPage(delta) query />`
  - `<VariantList variants loading errorText busy selectionCount onOpenPages(variantId) onNewVersion(variantId,label) onAddVariant />`
  - `<PageList pages loading errorText busy selectionCount onReplace(pageId, ordinal) />`

- [ ] **Step 1: `NewProposalView.tsx`** (ui.html 230–234행 + createNewProposal 480–505 + updateControls 809행)

```tsx
import { useEffect, useState } from 'react';

export function NewProposalView({
  visible,
  busy,
  selectionCount,
  resetKey,
  onCreate,
}: {
  visible: boolean;
  busy: boolean;
  selectionCount: number;
  resetKey: number;
  onCreate: (title: string) => void;
}) {
  const [title, setTitle] = useState('');

  // 생성 성공 시(App이 resetKey 증가) 제목 입력을 비운다.
  useEffect(() => {
    if (resetKey > 0) setTitle('');
  }, [resetKey]);

  const disabled = busy || selectionCount === 0 || !title.trim();

  return (
    <div className={'view' + (visible ? '' : ' hidden')} id="viewNew">
      <label htmlFor="title">제목</label>
      <input
        id="title"
        placeholder="시안 제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button type="button" id="createBtn" disabled={disabled} onClick={() => onCreate(title.trim())}>
        선택한 프레임으로 새 시안 만들기
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `ProposalList.tsx`** (ui.html 239–251행 + renderList/renderPager/loadProposals 552–623행)

```tsx
import type { ProposalListItem } from '../lib/api';

export function ProposalList({
  items,
  total,
  page,
  pageSize,
  loading,
  errorText,
  query,
  onQueryChange,
  onRefresh,
  onOpen,
  onPage,
}: {
  items: ProposalListItem[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  errorText: string;
  query: string;
  onQueryChange: (q: string) => void;
  onRefresh: () => void;
  onOpen: (id: string, title: string) => void;
  onPage: (delta: -1 | 1) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showPager = total > pageSize;

  return (
    <div id="listView">
      <div className="toolbar">
        <input
          id="search"
          placeholder="시안 검색…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <button className="soft sm" id="refreshBtn" type="button" onClick={onRefresh}>
          새로고침
        </button>
      </div>
      <div className="count" id="count">
        {loading || errorText ? '' : total + '개'}
      </div>
      <div id="list">
        {loading ? (
          <div className="loading">불러오는 중…</div>
        ) : errorText ? (
          <div className="empty">{errorText}</div>
        ) : items.length === 0 ? (
          <div className="empty">시안이 없습니다.</div>
        ) : (
          items.map((it) => {
            const title = it.title || '(제목 없음)';
            const parts: string[] = [];
            if (it.domain) parts.push(it.domain);
            if (it.publicId) parts.push('/' + it.publicId);
            return (
              <div className="item clickable" key={it.id} onClick={() => onOpen(it.id, title)}>
                <div className="info">
                  <div className="title">{title}</div>
                  <div className="meta">{parts.join(' · ')}</div>
                </div>
                <div className="chev">›</div>
              </div>
            );
          })
        )}
      </div>
      {showPager && !loading && !errorText && (
        <div className="pager" id="pager">
          <button
            className="soft sm"
            id="prevBtn"
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(-1)}
          >
            이전
          </button>
          <span id="pageInfo">{page + ' / ' + totalPages}</span>
          <button
            className="soft sm"
            id="nextBtn"
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPage(1)}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `VariantList.tsx`** (ui.html 253–260행 + renderVariants 649–690행)

```tsx
import type { Variant } from '../lib/api';

export function VariantList({
  title,
  variants,
  loading,
  errorText,
  busy,
  selectionCount,
  onBack,
  onOpenPages,
  onNewVersion,
  onAddVariant,
}: {
  title: string;
  variants: Variant[];
  loading: boolean;
  errorText: string;
  busy: boolean;
  selectionCount: number;
  onBack: () => void;
  onOpenPages: (variantId: string) => void;
  onNewVersion: (variantId: string, label: string) => void;
  onAddVariant: () => void;
}) {
  const needsSelDisabled = busy || selectionCount === 0;
  return (
    <div id="detailView">
      <div className="detailhead">
        <button className="ghost sm" id="backBtn" type="button" onClick={onBack}>
          ← 목록
        </button>
        <div className="detailtitle" id="detailTitle">
          {title}
        </div>
      </div>
      <div id="variants">
        {loading ? (
          <div className="loading">불러오는 중…</div>
        ) : errorText ? (
          <div className="empty">{errorText}</div>
        ) : variants.length === 0 ? (
          <div className="empty">안이 없습니다.</div>
        ) : (
          variants.map((v) => {
            const label = v.label || v.slug || '?';
            const pageCount = v.pages ? v.pages.length : 0;
            const versionCount = v.versions ? v.versions.length : 0;
            return (
              <div className="item clickable" key={v.id} onClick={() => onOpenPages(v.id)}>
                <div className="info">
                  <div className="title">{'안 ' + label}</div>
                  <div className="meta">
                    {versionCount + '개 버전 · 현재 ' + pageCount + '장'}
                  </div>
                </div>
                <button
                  className="sm"
                  type="button"
                  disabled={needsSelDisabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewVersion(v.id, label);
                  }}
                >
                  새 버전
                </button>
                <div className="chev">›</div>
              </div>
            );
          })
        )}
      </div>
      <button
        className="sm"
        id="addVariantBtn"
        type="button"
        disabled={needsSelDisabled}
        onClick={onAddVariant}
      >
        ＋ 새 안 추가 (선택 프레임)
      </button>
    </div>
  );
}
```

- [ ] **Step 4: `PageList.tsx`** (ui.html 262–269행 + renderPages 726–763행)

```tsx
import type { Page } from '../lib/api';

export function PageList({
  title,
  pages,
  loading,
  errorText,
  busy,
  selectionCount,
  onBack,
  onReplace,
}: {
  title: string;
  pages: Page[];
  loading: boolean;
  errorText: string;
  busy: boolean;
  selectionCount: number;
  onBack: () => void;
  onReplace: (pageId: string, ordinal: number) => void;
}) {
  const needsSelDisabled = busy || selectionCount === 0;
  return (
    <div id="pagesView">
      <div className="detailhead">
        <button className="ghost sm" id="pagesBackBtn" type="button" onClick={onBack}>
          ← 안 목록
        </button>
        <div className="detailtitle" id="pagesTitle">
          {title}
        </div>
      </div>
      <div className="hint">교체는 캔버스에서 선택한 첫 프레임을 사용합니다.</div>
      <div id="pages">
        {loading ? (
          <div className="loading">불러오는 중…</div>
        ) : errorText ? (
          <div className="empty">{errorText}</div>
        ) : pages.length === 0 ? (
          <div className="empty">이미지가 없습니다.</div>
        ) : (
          pages.map((p, idx) => (
            <div className="page" key={p.id}>
              <img
                src={p.url || undefined}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                }}
                alt=""
              />
              <div className="info">
                <div className="title">{idx + 1 + '페이지'}</div>
                <div className="meta">{(p.width || '?') + ' × ' + (p.height || '?')}</div>
              </div>
              <button
                className="sm"
                type="button"
                disabled={needsSelDisabled}
                onClick={() => onReplace(p.id, idx + 1)}
              >
                교체
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 타입체크 + 커밋**

Run: `npm run typecheck`
Expected: 성공.

```bash
git add figma-plugin/src/ui/components/NewProposalView.tsx figma-plugin/src/ui/components/ProposalList.tsx figma-plugin/src/ui/components/VariantList.tsx figma-plugin/src/ui/components/PageList.tsx
git commit -m "refactor(figma-plugin): add new/list/variant/page view components"
```

---

### Task 12: ExistingView (내비 + 비동기 플로우)

기존 시안 탭의 컨테이너. 내부 내비(`list|detail|pages`)와 데이터 로딩, 그리고 새 버전/새 안/페이지 교체 플로우를 소유한다. ui.html의 `switchExistingView`/`openDetail`/`loadDetail`/`openPages`/`loadPages`/`addVersionToVariant`/`addVariantToProposal`/`replacePage`/`loadProposals` 로직 이전.

**Files:**
- Create: `figma-plugin/src/ui/components/ExistingView.tsx`

**Interfaces:**
- Consumes: `ApiClient`, `ProposalListItem/Variant/Page`, `useUploadRunner`의 `run`, `filesMeta/confirmPages/putToSignedUrl/uploadAll`, `PAGE_SIZE`.
- Produces: `<ExistingView visible active api run busy selectionCount notify onUploaded(proposalId) />`
  - `run: (label, fn) => Promise<void>` (useUploadRunner)
  - `onUploaded(proposalId)`: 업로드 성공 시 App에 "관리화면 열기" 대상 통지(showOpen 대응).

- [ ] **Step 1: `ExistingView.tsx` 구현**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { ApiClient, Page, ProposalListItem, Variant } from '../lib/api';
import type { SetStatus } from '../hooks/useUploadRunner';
import type { ExportedImage } from '../../shared/messages';
import { PAGE_SIZE } from '../config';
import { humanize } from '../lib/errors';
import { confirmPages, filesMeta, putToSignedUrl, uploadAll } from '../lib/upload';
import { ProposalList } from './ProposalList';
import { VariantList } from './VariantList';
import { PageList } from './PageList';

type Nav = 'list' | 'detail' | 'pages';

export function ExistingView({
  visible,
  active,
  api,
  run,
  busy,
  selectionCount,
  notify,
  onUploaded,
}: {
  visible: boolean;
  active: boolean;
  api: ApiClient;
  run: (label: string, fn: (images: ExportedImage[], setStatus: SetStatus) => Promise<void>) => Promise<void>;
  busy: boolean;
  selectionCount: number;
  notify: (message: string, error?: boolean) => void;
  onUploaded: (proposalId: string) => void;
}) {
  const [nav, setNav] = useState<Nav>('list');

  // 목록
  const [items, setItems] = useState<ProposalListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const loadedRef = useRef(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 상세(안 목록)
  const [detail, setDetail] = useState<{ proposalId: string; title: string } | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // 페이지
  const [pagesCtx, setPagesCtx] = useState<{
    proposalId: string;
    variantId: string;
    versionId: string | null;
    label: string | null;
  } | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [pagesTitle, setPagesTitle] = useState('페이지');
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesError, setPagesError] = useState('');

  /* ── 목록 로드 ── */
  async function loadProposals(p = page, q = query) {
    loadedRef.current = true;
    setListLoading(true);
    setListError('');
    try {
      const data = await api.listProposals(p, PAGE_SIZE, q.trim());
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setItems([]);
      setListError(humanize(e instanceof Error ? e.message : String(e)));
    } finally {
      setListLoading(false);
    }
  }

  // 탭이 처음 활성화될 때 1회 로드(원본 listLoaded 동작).
  useEffect(() => {
    if (active && !loadedRef.current) loadProposals(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function onQueryChange(q: string) {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      loadProposals(1, q);
    }, 300);
  }
  function onPage(delta: -1 | 1) {
    const next = page + delta;
    if (next < 1) return;
    setPage(next);
    loadProposals(next, query);
  }

  /* ── 상세(안 목록) ── */
  async function loadDetail(proposalId: string) {
    setDetailLoading(true);
    setDetailError('');
    try {
      const d = await api.getProposal(proposalId);
      setVariants(d.variants || []);
    } catch (e) {
      setVariants([]);
      setDetailError(humanize(e instanceof Error ? e.message : String(e)));
    } finally {
      setDetailLoading(false);
    }
  }
  function openDetail(proposalId: string, title: string) {
    setDetail({ proposalId, title });
    setVariants([]);
    setNav('detail');
    loadDetail(proposalId);
  }

  /* ── 페이지 ── */
  async function loadPages(ctx: { proposalId: string; variantId: string }) {
    setPagesLoading(true);
    setPagesError('');
    try {
      const d = await api.getProposal(ctx.proposalId);
      const v = (d.variants || []).find((x) => x.id === ctx.variantId);
      if (!v) {
        setPages([]);
        setPagesError('안을 찾을 수 없습니다.');
        return;
      }
      const label = v.label || v.slug || '?';
      setPagesCtx({
        proposalId: ctx.proposalId,
        variantId: ctx.variantId,
        versionId: v.currentVersionId ?? null,
        label,
      });
      setPagesTitle('안 ' + label + ' · 현재 버전');
      setPages(v.pages || []);
    } catch (e) {
      setPages([]);
      setPagesError(humanize(e instanceof Error ? e.message : String(e)));
    } finally {
      setPagesLoading(false);
    }
  }
  function openPages(variantId: string) {
    if (!detail) return;
    setPagesCtx({ proposalId: detail.proposalId, variantId, versionId: null, label: null });
    setPagesTitle('페이지');
    setPages([]);
    setNav('pages');
    loadPages({ proposalId: detail.proposalId, variantId });
  }

  /* ── 업로드 플로우 ── */
  async function onNewVersion(variantId: string, label: string) {
    if (!detail) return;
    const pid = detail.proposalId;
    await run('안 ' + label + ' 새 버전', async (images, setStatus) => {
      const ver = await api.addVersion(pid, variantId, '');
      const issued = await api.issuePages(pid, variantId, ver.versionId, filesMeta(images));
      await uploadAll(issued.uploads, images, (d, t) => setStatus('업로드 중 ' + d + '/' + t + '…'));
      await api.confirmPages(pid, variantId, ver.versionId, confirmPages(issued.uploads, images));
      notify('안 ' + label + ' v' + ver.versionNo + ' 업로드됨');
      onUploaded(pid);
      await loadDetail(pid);
    });
  }

  async function onAddVariant() {
    if (!detail) return;
    const pid = detail.proposalId;
    await run('새 안 추가', async (images, setStatus) => {
      const created = await api.addVariant(pid, filesMeta(images));
      await uploadAll(created.uploads, images, (d, t) => setStatus('업로드 중 ' + d + '/' + t + '…'));
      await api.confirmPages(pid, created.variantId, created.versionId, confirmPages(created.uploads, images));
      notify('새 안 ' + created.label + ' 추가됨');
      onUploaded(pid);
      await loadDetail(pid);
    });
  }

  async function onReplace(pageId: string, ordinal: number) {
    const ctx = pagesCtx;
    if (!ctx || !ctx.versionId) return;
    const verId = ctx.versionId;
    await run(ordinal + '페이지 교체', async (images) => {
      const img = images[0];
      if (!img) throw new Error('NO_SELECTION');
      const issued = await api.replacePageIssue(ctx.proposalId, ctx.variantId, verId, pageId, {
        contentType: img.contentType,
        size: img.bytes.byteLength,
      });
      await putToSignedUrl(issued.signedUrl, img);
      await api.confirmPageReplace(ctx.proposalId, ctx.variantId, verId, pageId, {
        path: issued.path,
        width: img.width,
        height: img.height,
      });
      notify(ordinal + '페이지 교체됨');
      onUploaded(ctx.proposalId);
      await loadPages({ proposalId: ctx.proposalId, variantId: ctx.variantId });
    });
  }

  return (
    <div className={'view' + (visible ? '' : ' hidden')} id="viewExisting">
      {nav === 'list' && (
        <ProposalList
          items={items}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          loading={listLoading}
          errorText={listError}
          query={query}
          onQueryChange={onQueryChange}
          onRefresh={() => loadProposals(page, query)}
          onOpen={openDetail}
          onPage={onPage}
        />
      )}
      {nav === 'detail' && (
        <VariantList
          title={detail?.title || ''}
          variants={variants}
          loading={detailLoading}
          errorText={detailError}
          busy={busy}
          selectionCount={selectionCount}
          onBack={() => {
            setDetail(null);
            setNav('list');
          }}
          onOpenPages={openPages}
          onNewVersion={onNewVersion}
          onAddVariant={onAddVariant}
        />
      )}
      {nav === 'pages' && (
        <PageList
          title={pagesTitle}
          pages={pages}
          loading={pagesLoading}
          errorText={pagesError}
          busy={busy}
          selectionCount={selectionCount}
          onBack={() => {
            setPagesCtx(null);
            setNav('detail');
          }}
          onReplace={onReplace}
        />
      )}
    </div>
  );
}
```

> 주의(동작 보존): `nav`별 조건부 렌더링은 원본의 `switchExistingView`(display 토글)와 동일 결과. 단, `visible`(탭 전환)은 **언마운트 없이** `hidden` 클래스로만 숨겨 ExistingView 내부 상태(현재 nav/목록 페이지)를 보존한다(원본 동작과 일치).

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npm run typecheck`
Expected: 성공.

```bash
git add figma-plugin/src/ui/components/ExistingView.tsx
git commit -m "refactor(figma-plugin): add ExistingView with nav + upload flows"
```

---

### Task 13: App.tsx + main.tsx 최종 배선

최상위 조립: 훅 + api 클라이언트 + 로그인/앱 라우팅 + 새 시안 플로우 + 탭/상태/관리화면 열기.

**Files:**
- Create: `figma-plugin/src/ui/App.tsx`
- Modify: `figma-plugin/src/ui/main.tsx` (플레이스홀더 → 최종)

**Interfaces:**
- Consumes: 모든 훅/컴포넌트/`createApiClient`/`applyFigmaTheme`/`API_BASE`.

- [ ] **Step 1: `App.tsx` 구현**

```tsx
import { useMemo, useState } from 'react';
import { API_BASE } from './config';
import { createApiClient } from './lib/api';
import { confirmPages, filesMeta, uploadAll } from './lib/upload';
import { useSession, type SessionConfig } from './hooks/useSession';
import { useFigmaBridge } from './hooks/useFigmaBridge';
import { useUploadRunner } from './hooks/useUploadRunner';
import { CovaLogoSymbol } from './components/CovaLogo';
import { Login } from './components/Login';
import { Header } from './components/Header';
import { SelectionBar } from './components/SelectionBar';
import { Tabs } from './components/Tabs';
import { StatusBar } from './components/StatusBar';
import { NewProposalView } from './components/NewProposalView';
import { ExistingView } from './components/ExistingView';

export function App() {
  const session = useSession();
  const { config, isAuthed, isEditor } = session;

  const [tab, setTab] = useState<'new' | 'existing'>('new');
  const [openProposalId, setOpenProposalId] = useState<string | null>(null);
  const [createKey, setCreateKey] = useState(0);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginErr, setLoginErr] = useState('');

  const bridge = useFigmaBridge(session.hydrate);
  const { selectionCount, exportSelection, notify, openUrl, close: _close } = bridge;

  const runner = useUploadRunner({
    exportSelection,
    notify,
    onBeforeRun: () => setOpenProposalId(null), // hideOpen
  });
  const { busy, status, setStatus, run } = runner;

  // api 클라이언트는 1회 생성. 토큰은 useSession ref로 항상 최신 읽기.
  const api = useMemo(
    () => createApiClient({ baseUrl: API_BASE, getTokens: session.getTokens, onTokens: session.setTokens }),
    [session.getTokens, session.setTokens],
  );

  /* ── 로그인 ── */
  async function doLogin(email: string, password: string) {
    setLoginErr('');
    if (!email || !password) {
      setLoginErr('이메일과 비밀번호를 입력하세요.');
      return;
    }
    setLoginBusy(true);
    try {
      const data = await api.login(email, password);
      const next: SessionConfig = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        user: data.user,
      };
      session.setSession(next);
    } catch (e) {
      const { humanize } = await import('./lib/errors');
      setLoginErr(humanize(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoginBusy(false);
    }
  }

  function doLogout() {
    session.logout();
    setStatus('');
    setOpenProposalId(null);
    setTab('new');
  }

  /* ── 새 시안 ── */
  async function onCreate(title: string) {
    if (!title) {
      setStatus('제목을 입력하세요.', true);
      return;
    }
    await run('새 시안 생성', async (images, setStatus2) => {
      const created = await api.createProposal(title, filesMeta(images));
      await uploadAll(created.uploads, images, (d, t) => setStatus2('업로드 중 ' + d + '/' + t + '…'));
      await api.confirmPages(
        created.proposalId,
        created.variantId,
        created.versionId,
        confirmPages(created.uploads, images),
      );
      notify('새 시안 “' + title + '” 생성됨');
      setCreateKey((k) => k + 1); // 제목 입력 리셋
      setOpenProposalId(created.proposalId);
    });
  }

  if (!isAuthed) {
    return (
      <>
        <CovaLogoSymbol />
        <Login busy={loginBusy} errorText={loginErr} onSubmit={doLogin} onSignup={() => openUrl(API_BASE.replace(/\/+$/, '') + '/signup')} />
      </>
    );
  }

  const user = config.user || {};
  return (
    <>
      <CovaLogoSymbol />
      <Header user={user} onLogout={doLogout} />
      {!isEditor && (
        <div className="warn" id="roleWarn">
          편집 권한이 없는 계정입니다. 업로드가 막힙니다.
        </div>
      )}
      <SelectionBar count={selectionCount} />
      <Tabs tab={tab} onChange={setTab} />

      <NewProposalView
        visible={tab === 'new'}
        busy={busy}
        selectionCount={selectionCount}
        resetKey={createKey}
        onCreate={onCreate}
      />
      <ExistingView
        visible={tab === 'existing'}
        active={tab === 'existing'}
        api={api}
        run={run}
        busy={busy}
        selectionCount={selectionCount}
        notify={notify}
        onUploaded={setOpenProposalId}
      />

      <StatusBar
        status={status}
        openVisible={!!openProposalId}
        onOpen={() => {
          if (openProposalId)
            openUrl(API_BASE.replace(/\/+$/, '') + '/studio/proposals/' + openProposalId);
        }}
      />
    </>
  );
}
```

> 구조 메모: 원본 `<section id="app" style="display: contents">`는 `display:contents`로 자식만 레이아웃에 참여시킨다. 프래그먼트(`<>…</>`)가 동일 효과를 낸다(추가 래퍼 박스 없음). 로그인 시에도 동일.
>
> 권한 경고: 원본은 항상 존재하고 `hidden`을 토글했지만, 결과(편집 권한 없을 때만 표시)는 동일하므로 조건부 렌더링으로 둔다.
>
> `_close`는 현재 UI에서 트리거가 없어 미사용(원본도 `close` 메시지는 main에만 정의되고 UI에서 호출 안 함). `noUnusedLocals` 회피 위해 `_` 프리픽스로 표시하거나, 구조분해에서 제외할 것.

- [ ] **Step 2: `main.tsx` 최종화**

```tsx
import { createRoot } from 'react-dom/client';
import { applyFigmaTheme } from './lib/theme';
import { App } from './App';
import './styles.css';

applyFigmaTheme();

const container = document.getElementById('root');
if (!container) throw new Error('root element missing');
createRoot(container).render(<App />);
```

- [ ] **Step 3: 미사용 식별자 정리 확인**

`App.tsx`에서 `_close`가 `noUnusedLocals`에 걸리면 구조분해에서 제거(`const { selectionCount, exportSelection, notify, openUrl } = bridge;`). 동작 영향 없음.

- [ ] **Step 4: 전체 타입체크 + 빌드**

Run: `npm run typecheck`
Expected: 성공(0 errors).
Run: `npm run build`
Expected: `dist/ui.html` + `dist/main.js` 생성. `dist/ui.html`에 로컬 외부 참조 없음(인라인), Pretendard CDN link만 존재.

- [ ] **Step 5: 커밋**

```bash
git add figma-plugin/src/ui/App.tsx figma-plugin/src/ui/main.tsx
git commit -m "refactor(figma-plugin): wire App + entry (login/app routing, new-proposal flow)"
```

---

### Task 14: manifest 전환 · README · 정리 · 최종 검증

**Files:**
- Modify: `figma-plugin/manifest.json`
- Modify: `figma-plugin/README.md`

**Interfaces:** 없음(통합/문서).

- [ ] **Step 1: `manifest.json` 빌드 경로 전환**

`"main": "code.js"` → `"main": "dist/main.js"`, `"ui": "ui.html"` → `"ui": "dist/ui.html"`. **`id`·`api`·`editorType`·`documentAccess`·`networkAccess`는 변경 금지.**

```json
{
  "name": "cova",
  "id": "1437300000000000001",
  "api": "1.0.0",
  "editorType": ["figma"],
  "main": "dist/main.js",
  "ui": "dist/ui.html",
  "documentAccess": "dynamic-page",
  "networkAccess": {
    "allowedDomains": ["*"],
    "reasoning": "cova API 연결 (개발 중). 배포 전 실제 운영 도메인으로 좁힐 것.",
    "devAllowedDomains": ["http://localhost:3000"]
  }
}
```

- [ ] **Step 2: 구버전 `ui.html` 제거**

```bash
git rm figma-plugin/ui.html
```

(구 `code.js`는 빌드 산출물이라 `.gitignore` 대상 — 추적 중이면 `git rm --cached figma-plugin/code.js`.)

- [ ] **Step 3: `README.md` 구성/빌드 섹션 갱신** — "구성" 표와 "빌드" 명령을 새 구조로:

```markdown
## 구성 (React + TypeScript + Vite)

| 파일 | 역할 |
|---|---|
| `manifest.json` | 플러그인 정의 (`main`, `ui`, `networkAccess`) |
| `src/main.ts` → `dist/main.js` | 메인(샌드박스): figma API + 세션 영속(`clientStorage`) |
| `src/shared/messages.ts` | UI ↔ main 메시지 타입 |
| `src/ui/**` → `dist/ui.html` | UI(iframe): React 화면 + 네트워크 요청(`fetch`). 단일 HTML로 인라인 빌드 |

## 빌드

​```bash
cd figma-plugin
npm install
npm run build      # dist/ui.html + dist/main.js
npm run dev        # ui/main 동시 watch
npm run test       # 단위 테스트
​```
```

> 나머지 README 내용(동작 방식/사용/메모)은 동작 불변이므로 유지.

- [ ] **Step 4: 최종 통합 검증**

Run: `npm run test`
Expected: 모든 테스트 PASS.
Run: `npm run typecheck`
Expected: 0 errors.
Run: `npm run build`
Expected: `dist/ui.html`, `dist/main.js` 생성.

- [ ] **Step 5: 커밋**

```bash
git add figma-plugin/manifest.json figma-plugin/README.md
git commit -m "chore(figma-plugin): point manifest at dist + update README, drop legacy ui.html"
```

- [ ] **Step 6: 수동 E2E 체크리스트 (Figma 데스크톱 — 사람이 실행)**

`Plugins → Development → Import plugin from manifest…`로 `figma-plugin/manifest.json` 재등록 후 확인:

1. [ ] 플러그인 실행 → 로그인 화면(라이트/다크 테마가 Figma에 맞게 적용).
2. [ ] 잘못된 자격 → 한국어 에러 문구. 올바른 로그인 → 앱 화면.
3. [ ] 닫았다 다시 열기 → 로그인 유지(세션 영속).
4. [ ] 편집 권한 없는 계정 → 상단 권한 경고 표시.
5. [ ] 프레임 선택 → "선택된 프레임: N개"로 갱신, 버튼 활성화.
6. [ ] 새 시안: 제목 입력 → 생성 → 업로드 진행 상태 → "관리화면 열기" 노출, 제목 입력 비워짐.
7. [ ] 기존 시안 탭: 목록/검색(debounce)/페이저(>8개) 동작.
8. [ ] 시안 클릭 → 안 목록. "새 버전"/"＋ 새 안 추가" 동작.
9. [ ] 안 클릭 → 페이지 목록. "교체"(선택 첫 프레임) 동작.
10. [ ] "← 목록"/"← 안 목록" 뒤로가기, 탭 전환 시 기존 시안 화면 위치 보존.
11. [ ] "관리화면 열기 ↗" → 브라우저로 `/studio/proposals/{id}` 열림.
12. [ ] 로그아웃 → 로그인 화면, 상태/열기 버튼 초기화.

---

## Self-Review

**1. Spec coverage** (스펙 각 절 → 태스크 매핑):
- §3 스택/빌드 → Task 1 (package/vite/vitest/tsconfig).
- §4 디렉토리 → Task 1·2·9 전반.
- §5 메시지 계약 → Task 2 (`shared/messages.ts`).
- §6 매핑(무엇이 어디로) → Task 3–12 전부.
- §7 API 클라이언트 → Task 6, 플로우는 Task 12·13.
- §8 상태/컴포넌트 → Task 8(훅)·10·11·12·13.
- §9 CSS/마크업 보존 → Task 1(index.html head: Pretendard)·9(styles.css)·각 컴포넌트.
- §10 검증 → Task 3–6(단위)·14(통합+E2E).
- §11 manifest/마이그레이션 → Task 2(code.ts 제거)·14(manifest/README/ui.html 제거).
- §12 리스크 → 각 컴포넌트의 "동작 보존" 메모 + Task 14 E2E.

**2. Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "TODO/TBD/적절히 처리" 없음. (단, Task 1의 `styles.css` 빈 파일/`main.tsx` 임시본은 Task 9/13에서 명시적으로 최종화 — 의도된 단계적 산출물.)

**3. Type consistency:** `createApiClient` 시그니처(`getTokens`/`onTokens`)가 Task 6 정의 = Task 13 사용 일치. `run(label, fn)`/`SetStatus` 시그니처가 Task 8 = Task 12·13 일치. `SessionConfig`/`useSession` 반환(`getTokens`/`setTokens`/`setSession`/`hydrate`/`logout`)이 Task 8 = Task 13 일치. `ProposalListItem`/`Variant`/`Page` 타입이 Task 6 정의 = Task 11·12 사용 일치. `Upload`/`ConfirmPage`/`FileMeta`가 Task 5 정의 = Task 6 import 일치.
```
