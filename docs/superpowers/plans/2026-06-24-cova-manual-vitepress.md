# cova 사용 매뉴얼 (VitePress) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cova 스튜디오·뷰어·Figma 플러그인 3개 제품의 한국어 사용 매뉴얼을 VitePress로 `manual/`에 만든다(16개 페이지, 본문 전체 작성, 이미지는 플레이스홀더).

**Architecture:** 저장소 루트의 `manual/`을 독립 서브패키지로 둔다(`figma-plugin/`과 동일 패턴: 자체 `package.json` + `node_modules`). VitePress 1.x로 상단 네비 3제품 분리 + 경로 기반 멀티 사이드바. 각 페이지 본문은 해당 기능의 실제 코드/라우트를 확인해 정확히 기술한다.

**Tech Stack:** VitePress ^1.6, Node ≥22, 한국어(`ko-KR`), 로컬 검색.

## Global Constraints

- 언어: **한국어**. 모든 본문/네비/사이드바 라벨 한국어.
- 위치: 루트 **`manual/`**. 메인 앱 루트 `package.json`은 수정 금지(서브패키지 자족).
- 화면 명칭·버튼 라벨은 **실제 UI 문구 그대로**(코드 기준). 추측 금지 — 불명확하면 소스 확인.
- 이미지: 실제 `<img>`/마크다운 이미지 삽입 금지. 이미지 자리는 아래 컨테이너만 사용:
  ```md
  ::: info 🖼 이미지 자리
  (한 줄 설명: 어떤 화면을 캡처해 넣을지)
  :::
  ```
- 권한 전용 메뉴(태그 설정·사용자 관리 = **admin 전용**)는 본문에 권한 명시.
- 검증 기준: `manual/`에서 `npm run docs:build`가 **무오류로 통과**(깨진 링크 0). 각 콘텐츠 태스크 끝에서 재실행.
- 커밋은 `manual:` 프리픽스. 기능 작업이므로 전용 브랜치에서 진행.

## 페이지 ↔ 소스 매핑 (본문 작성 시 반드시 확인할 위치)

| 페이지 | 확인할 소스 |
|--------|-------------|
| studio/index (시작하기) | `app/(auth)/{login,signup,forgot-password,reset-password}/page.tsx`, `app/pending/page.tsx`, `src/features/auth/index.ts`, `src/widgets/studio-shell/{ui/studio-sidebar.tsx,model/nav-config.ts}` |
| studio/proposals | `app/studio/proposals/{page.tsx,new/page.tsx}`, `src/features/{create-proposal,manage-pages}/index.ts` |
| studio/proposal-detail | `app/studio/proposals/[id]/page.tsx`, `src/features/{add-version,restore-version,manage-versions,manage-variants,add-variant,edit-proposal-settings,assign-proposal-tags}/index.ts` |
| studio/tags | `app/studio/tags/page.tsx`, `src/features/manage-tag-taxonomy/index.ts` |
| studio/users | `app/studio/users/page.tsx`, `src/features/manage-users/index.ts`, `src/shared/auth/roles.ts` |
| studio/account | `app/me/page.tsx` |
| viewer/index | `app/p/[publicId]/page.tsx`, `src/features/unlock-access/index.ts`, `src/shared/access/resolve-viewer-gate.server.ts` |
| viewer/preview | `src/pages/public-viewer/**`, `app/p/[publicId]/layout.tsx` (풀스크린/캔버스 토글) |
| viewer/collaboration | `src/features/{pin-comment,send-chat-message,manage-chat-message,whiteboard}/index.ts`, `app/chat/[publicId]/page.tsx` |
| viewer/guest | 게스트 이름 localStorage 흐름 — collaboration 관련 컴포넌트에서 확인 |
| plugin/index | `figma-plugin/README.md`, `figma-plugin/manifest.json` |
| plugin/login | `figma-plugin/README.md`, `app/plugin-auth/page.tsx`, `docs/figma-plugin-api.md` |
| plugin/new-proposal | `figma-plugin/README.md` (새 시안 탭) |
| plugin/new-version | `figma-plugin/README.md` (기존 시안 새 버전/안 탭) |

> 본문 표준 골격(페이지마다): ① 무엇을 하는 화면인가 ② 누가/사전조건(권한·로그인·승인) ③ 단계별 사용법(번호 목록) ④ 참고/주의. 분량은 메뉴 복잡도에 맞게.

---

## Task 1: VitePress 스캐폴드 + 네비/사이드바 + 전 페이지 스텁

전체 사이트 골격을 세우고 16개 페이지를 **스텁(제목 + 한 줄)** 으로 만들어 `docs:build`가 통과하게 한다. 이후 콘텐츠 태스크가 스텁을 본문으로 교체한다.

**Files:**
- Create: `manual/package.json`
- Create: `manual/.gitignore`
- Create: `manual/.vitepress/config.mts`
- Create: `manual/index.md` (home layout 스텁)
- Create: 15개 페이지 스텁:
  `manual/studio/{index,proposals,proposal-detail,tags,users,account}.md`,
  `manual/viewer/{index,preview,collaboration,guest}.md`,
  `manual/plugin/{index,login,new-proposal,new-version}.md`

**Interfaces:**
- Produces: 사이드바/네비가 참조하는 16개 경로(`/studio/...`, `/viewer/...`, `/plugin/...`)와 home(`/`). 이후 태스크는 이 파일들의 **내용만** 교체(경로/파일명 불변).

- [ ] **Step 1: `manual/package.json` 작성**

```json
{
  "name": "cova-manual",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "docs:dev": "vitepress dev",
    "docs:build": "vitepress build",
    "docs:preview": "vitepress preview"
  },
  "devDependencies": {
    "vitepress": "^1.6.4"
  }
}
```

- [ ] **Step 2: `manual/.gitignore` 작성**

```gitignore
node_modules
.vitepress/cache
.vitepress/dist
```

- [ ] **Step 3: `manual/.vitepress/config.mts` 작성**

```ts
import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "ko-KR",
  title: "cova 사용 매뉴얼",
  description: "cova 스튜디오·뷰어·Figma 플러그인 사용 안내",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "홈", link: "/" },
      { text: "스튜디오", link: "/studio/" },
      { text: "뷰어", link: "/viewer/" },
      { text: "Figma 플러그인", link: "/plugin/" },
    ],
    sidebar: {
      "/studio/": [
        {
          text: "cova 스튜디오",
          items: [
            { text: "시작하기", link: "/studio/" },
            { text: "시안", link: "/studio/proposals" },
            { text: "시안 상세·버전", link: "/studio/proposal-detail" },
            { text: "태그 설정", link: "/studio/tags" },
            { text: "사용자 관리", link: "/studio/users" },
            { text: "내 계정", link: "/studio/account" },
          ],
        },
      ],
      "/viewer/": [
        {
          text: "cova 뷰어",
          items: [
            { text: "시안 열기", link: "/viewer/" },
            { text: "프리뷰", link: "/viewer/preview" },
            { text: "실시간 회의", link: "/viewer/collaboration" },
            { text: "게스트 이름", link: "/viewer/guest" },
          ],
        },
      ],
      "/plugin/": [
        {
          text: "cova Figma 플러그인",
          items: [
            { text: "소개·설치", link: "/plugin/" },
            { text: "로그인", link: "/plugin/login" },
            { text: "새 시안 만들기", link: "/plugin/new-proposal" },
            { text: "새 버전·새 안 올리기", link: "/plugin/new-version" },
          ],
        },
      ],
    },
    search: { provider: "local" },
    outline: { label: "이 페이지 내용", level: [2, 3] },
    docFooter: { prev: "이전", next: "다음" },
  },
});
```

- [ ] **Step 4: `manual/index.md` 홈 작성 (home layout)**

```md
---
layout: home
hero:
  name: cova
  text: 사용 매뉴얼
  tagline: 시안을 올리고, 공유하고, 실시간으로 회의하세요.
  actions:
    - theme: brand
      text: 스튜디오 시작하기
      link: /studio/
    - theme: alt
      text: 뷰어
      link: /viewer/
    - theme: alt
      text: Figma 플러그인
      link: /plugin/
features:
  - title: cova 스튜디오
    details: 편집자·관리자가 시안을 만들고 버전·공개 설정을 관리하는 작업 공간.
    link: /studio/
  - title: cova 뷰어
    details: 공개 링크로 시안을 열람하고 커서·코멘트·채팅으로 실시간 회의.
    link: /viewer/
  - title: Figma 플러그인
    details: 피그마 프레임을 그대로 cova 시안/버전으로 올리는 플러그인.
    link: /plugin/
---
```

- [ ] **Step 5: 15개 페이지 스텁 생성**

각 파일은 H1 제목 + 한 줄 안내만. 예시 형식(모든 스텁 동일 패턴, 제목만 교체):

```md
# 시안

> 작성 예정.
```

스텁 제목 매핑:
- `studio/index.md` → `# 시작하기`
- `studio/proposals.md` → `# 시안`
- `studio/proposal-detail.md` → `# 시안 상세·버전`
- `studio/tags.md` → `# 태그 설정`
- `studio/users.md` → `# 사용자 관리`
- `studio/account.md` → `# 내 계정`
- `viewer/index.md` → `# 시안 열기`
- `viewer/preview.md` → `# 프리뷰`
- `viewer/collaboration.md` → `# 실시간 회의`
- `viewer/guest.md` → `# 게스트 이름`
- `plugin/index.md` → `# 소개·설치`
- `plugin/login.md` → `# 로그인`
- `plugin/new-proposal.md` → `# 새 시안 만들기`
- `plugin/new-version.md` → `# 새 버전·새 안 올리기`

- [ ] **Step 6: 의존성 설치 + 빌드 검증**

Run: `cd manual && npm install && npm run docs:build`
Expected: `build complete` 성공, 깨진 링크 경고 없음. (Node ≥22 필요)

- [ ] **Step 7: Commit**

```bash
git add manual/
git commit -m "manual: scaffold VitePress site with nav, sidebar, and page stubs"
```

---

## Task 2: 스튜디오 섹션 본문 (6 페이지)

스튜디오 6개 페이지를 실제 코드 기준으로 작성한다. 작성 전 위 "페이지↔소스 매핑"의 해당 소스를 읽어 화면명·버튼 라벨·흐름을 확정한다.

**Files:**
- Modify: `manual/studio/{index,proposals,proposal-detail,tags,users,account}.md`

**Interfaces:**
- Consumes: Task 1의 사이드바 경로(불변).
- Produces: 스튜디오 섹션 완성 본문. 타 섹션이 상호 링크로 참조(`/studio/proposal-detail` 등).

- [ ] **Step 1: 소스 확인**

Read: `app/studio/proposals/{page.tsx,new/page.tsx}`, `app/studio/proposals/[id]/page.tsx`, `app/studio/{tags,users}/page.tsx`, `app/me/page.tsx`, `app/(auth)/**`, `app/pending/page.tsx`, `src/widgets/studio-shell/model/nav-config.ts`, 그리고 매핑된 `src/features/*` 의 `index.ts`(노출 동작 파악). 라벨/문구를 본문에 그대로 반영.

- [ ] **Step 2: `studio/index.md` — 시작하기**

작성 내용(표준 골격 적용):
- 스튜디오가 무엇인지(편집자·관리자 작업 공간), 사이드바 구성(시안 / 태그 설정 / 사용자 관리 / 홈으로 / 내 계정).
- 가입 → 이메일 인증 → **승인 대기(`pending`)** → 관리자 승인 후 `editor`/`admin` 권한.
- 로그인, 비밀번호 찾기/재설정(있는 그대로), 첫 관리자 부트스트랩은 운영자 안내로 한 줄.
- 이미지 자리: 로그인 화면, 승인 대기 화면, 스튜디오 첫 진입(사이드바).
- 다음 단계 링크: `/studio/proposals`.

- [ ] **Step 3: `studio/proposals.md` — 시안 목록·생성**

- 시안 목록 화면(검색/필터/카드), "새 시안 만들기" 흐름(제목 입력, 이미지/페이지 업로드, v1 자동 생성).
- 권한: editor/admin.
- 이미지 자리: 시안 목록, 새 시안 폼.
- 상세 편집은 `/studio/proposal-detail`로 링크.

- [ ] **Step 4: `studio/proposal-detail.md` — 시안 상세·버전·설정**

- 버전 관리(새 버전 올리기/복원/버전 목록), 안(variant A·B) 개념, 공개/비공개·비밀번호 설정, 태그 부여.
- 공개 설정 → 뷰어로 연결(`/viewer/`), 비번 동작은 뷰어 문서 링크.
- 이미지 자리: 상세 화면, 버전 패널, 공개/비번 설정 다이얼로그.

- [ ] **Step 5: `studio/tags.md` — 태그 설정 (admin 전용)**

- 태그 분류(공통코드형) 관리, **admin 전용** 명시.
- 시안에 태그 부여는 `/studio/proposal-detail` 링크.
- 이미지 자리: 태그 설정 화면.

- [ ] **Step 6: `studio/users.md` — 사용자 관리 (admin 전용)**

- 가입 승인, 역할 변경(pending/editor/admin), **admin 전용** 명시.
- 역할별 권한 요약 표(roles.ts 기준).
- 이미지 자리: 사용자 목록·승인 화면.

- [ ] **Step 7: `studio/account.md` — 내 계정**

- `/me` 화면에서 가능한 동작(표시 이름 등 실제 구현 범위만).
- 이미지 자리: 내 계정 화면.

- [ ] **Step 8: 빌드 검증**

Run: `cd manual && npm run docs:build`
Expected: 성공, 깨진 링크 없음.

- [ ] **Step 9: Commit**

```bash
git add manual/studio/
git commit -m "manual: write studio section content"
```

---

## Task 3: 뷰어 섹션 본문 (4 페이지)

**Files:**
- Modify: `manual/viewer/{index,preview,collaboration,guest}.md`

**Interfaces:**
- Consumes: Task 1 경로, Task 2의 `/studio/proposal-detail`(공개 설정) 링크.

- [ ] **Step 1: 소스 확인**

Read: `app/p/[publicId]/{page.tsx,layout.tsx}`, `src/pages/public-viewer/**`, `src/shared/access/resolve-viewer-gate.server.ts`, `src/features/{unlock-access,pin-comment,send-chat-message,manage-chat-message,whiteboard}/index.ts`, `app/chat/[publicId]/page.tsx`. 실제 문구 반영(예: "비밀번호가 필요한 시안입니다.", "하루동안 기억하기", "열기", "비공개 시안").

- [ ] **Step 2: `viewer/index.md` — 시안 열기**

- 공개 링크(`/p/{publicId}`)로 로그인 없이 열람. 비공개/비번/공개 3단계 접근.
- 비밀번호 입력 화면 흐름("열기", "하루동안 기억하기"), 비공개 시 안내("관리자 권한이 필요합니다").
- 이미지 자리: 비번 게이트 화면, 뷰어 첫 화면.

- [ ] **Step 3: `viewer/preview.md` — 프리뷰**

- 풀스크린 슬라이드(1920 고정, 클릭/키보드 넘김, 페이지 인디케이터) ↔ 캔버스 뷰(pan/zoom) 토글.
- 이미지 자리: 풀스크린, 캔버스 뷰.

- [ ] **Step 4: `viewer/collaboration.md` — 실시간 회의**

- 접속자 커서(presence), 핀 코멘트(클릭해서 꽂기·스레드·resolved), 채팅 패널.
- 이미지 자리: 커서 표시, 핀 코멘트, 채팅 패널.

- [ ] **Step 5: `viewer/guest.md` — 게스트 이름**

- 열람은 이름 없이, 코멘트/채팅 **첫 작성 시** 인라인 이름 입력 → localStorage 저장.
- 이미지 자리: 게스트 이름 입력.

- [ ] **Step 6: 빌드 검증**

Run: `cd manual && npm run docs:build`
Expected: 성공, 깨진 링크 없음.

- [ ] **Step 7: Commit**

```bash
git add manual/viewer/
git commit -m "manual: write viewer section content"
```

---

## Task 4: 플러그인 섹션 본문 (4 페이지)

**Files:**
- Modify: `manual/plugin/{index,login,new-proposal,new-version}.md`

**Interfaces:**
- Consumes: Task 1 경로. 업로드 완료 후 "관리화면 열기"는 `/studio/proposal-detail` 링크로 연결.

- [ ] **Step 1: 소스 확인**

Read: `figma-plugin/README.md`, `figma-plugin/manifest.json`, `app/plugin-auth/page.tsx`, `docs/figma-plugin-api.md`. 실제 라벨("새 시안", "기존 시안에 새 버전", "＋ 새 안 추가", "관리화면 열기 ↗", "로그인 완료") 반영.

- [ ] **Step 2: `plugin/index.md` — 소개·설치**

- 플러그인 역할(피그마 프레임 → cova 시안/버전), 설치(Plugins → Development → Import plugin from manifest… → `figma-plugin/manifest.json` → cova 실행).
- 현재 범위 안내(로그인·시안목록·새 시안·새 버전; 개별 이미지 교체는 후속).
- 이미지 자리: 플러그인 임포트, 플러그인 첫 화면.

- [ ] **Step 3: `plugin/login.md` — 로그인(페어링)**

- 외부 브라우저 페어링: 플러그인이 키 생성 → 브라우저에서 `/plugin-auth?k=...` 로그인 → "로그인 완료. 피그마로 돌아가면 자동으로 로그인됩니다." → 플러그인 폴링으로 토큰 수신.
- editor/admin 권한 없으면 업로드 `FORBIDDEN`.
- 이미지 자리: 플러그인 로그인 화면, 브라우저 완료 화면.

- [ ] **Step 4: `plugin/new-proposal.md` — 새 시안 만들기**

- 프레임 선택(여러 개=선택 순서대로 페이지) → "새 시안" 탭 → 제목 입력 → "선택한 프레임으로 새 시안 만들기".
- PNG 1x 내보내기, 25MB 제한 주의.
- 이미지 자리: 프레임 선택, 새 시안 탭.

- [ ] **Step 5: `plugin/new-version.md` — 새 버전·새 안**

- "기존 시안에 새 버전" 탭: 시안 검색 → 안(A·B…) 목록 → "새 버전"(그 안의 새 버전) / "＋ 새 안 추가"(새 label 자동).
- 완료 후 "관리화면 열기 ↗"(브라우저로 `/studio/proposals/{id}`) → `/studio/proposal-detail` 링크.
- 이미지 자리: 기존 시안 탭, 안 목록.

- [ ] **Step 6: 빌드 검증**

Run: `cd manual && npm run docs:build`
Expected: 성공, 깨진 링크 없음.

- [ ] **Step 7: Commit**

```bash
git add manual/plugin/
git commit -m "manual: write plugin section content"
```

---

## Task 5: 마무리 — 상호 링크 점검 + 최종 빌드

**Files:**
- Modify: 필요 시 `manual/index.md` 및 섹션 간 링크가 있는 페이지.

- [ ] **Step 1: 상호 링크 점검**

각 페이지의 교차 링크가 실제 경로와 일치하는지 확인:
스튜디오 공개설정 → `/viewer/`, 뷰어 → `/studio/proposal-detail`(공개설정), 플러그인 업로드완료 → `/studio/proposal-detail`. 누락/오타 수정.

- [ ] **Step 2: 최종 빌드 + 링크 검증**

Run: `cd manual && npm run docs:build`
Expected: 성공, **깨진 링크 경고 0**. 경고 있으면 해당 링크 수정 후 재빌드.

- [ ] **Step 3: 로컬 미리보기로 육안 확인(선택)**

Run: `cd manual && npm run docs:preview`
Expected: 네비 3제품 전환·사이드바·검색 동작, 이미지 자리 컨테이너가 보임.

- [ ] **Step 4: Commit**

```bash
git add manual/
git commit -m "manual: cross-link pass and final build verification"
```

---

## Self-Review (작성자 체크 완료)

- **Spec coverage:** 16개 페이지 = 스펙 IA의 전 메뉴 1:1 매핑(Task 1 스텁 → Task 2~4 본문). 기술구성(서브패키지·VitePress·ko·로컬검색) Task 1. 이미지 플레이스홀더 규칙 Global Constraints + 각 본문 step. 검증(docs:build) 각 태스크 + Task 5.
- **Placeholder scan:** 코드/설정 블록은 실제 내용 포함. 본문 prose는 "소스 확인 후 작성"이 의도된 실행 방식(문서 정확성 보장) — 각 step에 다룰 항목·문구·이미지 자리를 구체적으로 명시함.
- **Type/경로 일관성:** 사이드바 링크 경로 ↔ 파일 경로 ↔ 상호 링크 경로 동일하게 유지(`/studio/proposal-detail` 등). `cleanUrls: true` 기준 링크는 확장자 없이.
