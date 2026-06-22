# 로그인 페이지 리디자인 — 디자인 스펙

> 작성일: 2026-06-22
> 기준 디자인 시스템: `docs/design-system.md`
> 방향: **중앙 카드 정제** (단일 중앙 카드 유지 + 디자인 시스템 chrome 정식 적용)

## 1. 목표 / 배경

현재 로그인 페이지(`src/pages/login/ui/login-page.tsx`)는 shadcn 기본형에 가깝다.
디자인 시스템(`docs/design-system.md`)의 시그니처 — 레이어드 드롭섀도우, 8px 카드
chrome, hairline 보더, Pretendard 타입 스케일, 아이브로우 라벨 — 이 아직 입혀지지
않았다. 구조(단일 중앙 카드)는 유지하면서 chrome·타이포를 디자인 시스템에 맞춰
정제하는 것이 목표.

회원가입 페이지(`src/pages/signup/ui/signup-page.tsx`)는 로그인과 짝을 이루는 동일
구조다. 디자인 시스템도 "인증 카드"를 로그인/가입 공용 패턴으로 둔다. 이번 작업은
**로그인만** 변경하되, 적용하는 chrome·유틸리티는 가입이 나중에 그대로 물려받을 수
있도록 재사용 가능하게 만든다.

## 2. 범위

**손대는 파일**

- `src/pages/login/ui/login-page.tsx` — 레이아웃, 카드 chrome, 아이브로우/제목/보조문구, 가입 링크
- `src/features/auth/ui/login-form.tsx` — 인풋 라운드 4px, 주 버튼 높이
- `src/app/styles/globals.css` — `.shadow-layered-2` 유틸 추가 (레벨2 레이어드 섀도우)

**비목표 (이번에 안 함)**

- 회원가입 페이지 변경 (다음 작업에서 동일 패턴 적용)
- 다크모드 대응 (auth는 흰 캔버스 기준)
- 로고 이미지 도입 (텍스트 워드마크 사용 — 앱 전역과 일관)
- 공유 `Input`/`Button` 컴포넌트의 전역 기본값 변경 (변경은 auth 화면에 국한)

## 3. 상세 디자인

### 3.1 레이아웃 & 배경

- 전체 화면 중앙 정렬, 배경 흰 캔버스(`bg-background`) 유지.
- 카드: `w-full max-w-sm`, 내부 패딩 32px(`p-8`).
- 세로 리듬(위→아래): 아이브로우 → 제목 → 보조문구 → 폼 → 디바이더 → 가입 링크.

### 3.2 카드 chrome

- 라운드 **8px** — 현재 `Card`의 `rounded-xl`(≈11px)을 `rounded-lg`(0.5rem=8px)로 override.
- **hairline 보더 + 레벨2 레이어드 섀도우** 로 흰 바탕 위에 떠 보이게.
  - 기존 `Card`의 옅은 `ring`은 제거(`ring-0`)하고 `border border-border`로 교체.
  - 섀도우는 `.shadow-layered-2` 유틸 적용.

### 3.3 `.shadow-layered-2` 유틸 (globals.css)

디자인 시스템 §5 레벨2 값을 그대로 옮긴 재사용 유틸. Tailwind v4 `@utility`로 정의.

```css
@utility shadow-layered-2 {
  box-shadow:
    0 84px 24px rgba(0, 0, 0, 0),
    0 54px 22px rgba(0, 0, 0, 0.01),
    0 30px 18px rgba(0, 0, 0, 0.04),
    0 13px 13px rgba(0, 0, 0, 0.08),
    0 3px 7px rgba(0, 0, 0, 0.09);
}
```

### 3.4 타이포 & 콘텐츠

| 요소 | 내용 | 스타일 |
|------|------|--------|
| 아이브로우 | `UXIS LIVE DESIGN` | UPPERCASE, 12px, `tracking-[0.06em]` 정도, `text-muted-foreground`, `font-medium` |
| 제목 | `로그인` | 24px(`text-2xl`), **weight 500**(`font-medium`, 기존 semibold에서 하향), `tracking-tight` |
| 보조문구 | `이메일로 계속하세요` | `text-sm text-muted-foreground` |
| 가입 링크 | `계정이 없으신가요? 가입` | 앞 텍스트 `text-muted-foreground`, `가입`만 `underline` ink. 위에 hairline 디바이더 한 줄. |

> weight 상한 600 준수: 제목은 display-sm 토큰(500)에 맞춰 `font-medium` 사용.

### 3.5 폼 (login-form.tsx)

- 인풋: 라운드 **4px**로 통일(`className="rounded-[4px]"`). 디자인 시스템 §4 입력=4px.
  공유 `Input`의 전역 기본은 건드리지 않고 auth 폼에서만 override.
- 주 버튼: near-black 풀폭, 4px 유지(컴포넌트 기본). 높이 `h-8`(32px) → **`h-10`(40px)**
  로 키워 1차 CTA 비중 부여.
- 라벨/에러/제출 로직은 현행 유지.

## 4. 검증 기준

- 로그인 카드가 흰 바탕 위에서 레이어드 섀도우로 떠 보인다.
- 카드 라운드 8px, 인풋·버튼 라운드 4px로 시각적으로 일관.
- 아이브로우 → 제목 → 보조문구 위계가 명확.
- 비밀번호/이메일 검증·에러·제출 등 **기능 동작은 변화 없음**.
- 빌드/타입체크 통과(`pnpm build` 또는 프로젝트 표준 명령).

## 5. 미해결 / 가정

- 아이브로우 워드마크는 대문자 `UXIS LIVE DESIGN`으로 가정(사용자 승인됨). 기존
  사이드바는 소문자 `uxis live design`이라 표기 차이가 있으나, 로그인은 브랜드
  모먼트라 디자인 시스템의 eyebrow-UPPERCASE 규칙을 따른다.
