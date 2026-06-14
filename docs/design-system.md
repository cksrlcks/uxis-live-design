# uxis-live-design — 디자인 시스템

> 출처: `DESIGN-webflow.md` (Webflow 디자인 언어)를 본 프로젝트 스택에 맞게 적응.
> 스택: **Next.js + Tailwind + shadcn/ui + Pretendard**
> 작성일: 2026-06-15

## 0. 원본 대비 조정 사항 (중요)

| 항목 | Webflow 원본 | 본 프로젝트 |
|------|--------------|-------------|
| 폰트 | WF Visual Sans / Inter | **Pretendard** (타입 스케일·weight·tracking은 그대로 계승) |
| weight 상한 | 600 | **600 유지** (700+ 금지) |
| 5-stop 액센트 용도 | 마케팅 카테고리 카드 풀필 | **실시간 접속자 커서 색 + 상태 뱃지 + 아바타 라벨** (앱 성격에 맞게 재매핑) |
| 마케팅 전용 컴포넌트 (hero-band, category-card, pricing-tier) | 사용 | 앱이라 직접 사용 안 함. 단 토큰·기법(섀도우/뱃지/카드 chrome)은 앱 컴포넌트에 계승 |
| surface 계층 | canvas + hairline 만 | 앱 hover/zebra/사이드바용 **`surface-soft` 1단계 추가**(원본엔 없던 확장, 아래 표시) |

핵심 정체성은 유지: **near-black `#080808` 주색 + 넓은 white 캔버스 + hairline 보더 + 절제된 4px/8px 라운드 + 레이어드 드롭섀도우**.

## 1. 컬러 토큰

### 1.1 기본 팔레트 (Webflow 그대로)

| 역할 | 토큰 | HEX |
|------|------|-----|
| 주색 (CTA·제목·잉크) | `primary` / `ink` | `#080808` |
| 주색 위 텍스트 | `on-primary` | `#ffffff` |
| 잉크 강조 | `ink-strong` | `#222222` |
| 본문 | `body` | `#363636` |
| 본문 중간 | `body-mid` | `#5a5a5a` |
| 흐림 | `mute` | `#898989` |
| 흐림 약 (placeholder) | `mute-soft` | `#ababab` |
| 헤어라인 (보더/디바이더) | `hairline` | `#d8d8d8` |
| 캔버스 (페이지 배경) | `canvas` | `#ffffff` |
| **surface-soft** (앱 확장) | `surface-soft` | `#f7f7f7` |

### 1.2 액센트 / 시맨틱

| 역할 | 토큰 | HEX |
|------|------|-----|
| 액센트 퍼플 | `accent-purple` | `#7a3dff` |
| 액센트 핑크 | `accent-pink` | `#ed52cb` |
| 액센트 블루 | `accent-blue` | `#3b89ff` |
| 액센트 블루(딥, 강조링크) | `accent-blue-deep` | `#006acc` |
| 인포 블루 (뱃지/포커스링) | `accent-blue-info` | `#146ef5` |
| 액센트 오렌지 | `accent-orange` | `#ff6b00` |
| 액센트 그린 (성공) | `accent-green` | `#00d722` |
| 액센트 옐로 (경고) | `accent-yellow` | `#ffae13` |
| 액센트 레드 (에러/파괴적) | `accent-red` | `#ee1d36` |

- **시맨틱:** info=`accent-blue-info`, success=`accent-green`, warning=`accent-yellow`, error=`accent-red`.
- **5-stop 커서 팔레트:** purple → pink → blue → orange → green 순환으로 실시간 접속자에게 색 배정.

### 1.3 shadcn/ui CSS 변수 매핑 (globals.css `@layer base`에서 구현 예정)

| shadcn 변수 | 값(HEX) | 비고 |
|-------------|---------|------|
| `--background` | `#ffffff` | canvas |
| `--foreground` | `#080808` | ink |
| `--primary` | `#080808` | near-black CTA |
| `--primary-foreground` | `#ffffff` | |
| `--secondary` | `#ffffff` | 보더로 구분(아래 button-secondary) |
| `--secondary-foreground` | `#080808` | |
| `--muted` | `#f7f7f7` | surface-soft (hover/zebra) |
| `--muted-foreground` | `#5a5a5a` | body-mid |
| `--accent` | `#f7f7f7` | hover 배경 |
| `--accent-foreground` | `#080808` | |
| `--card` | `#ffffff` / `--card-foreground` `#080808` | |
| `--popover` | `#ffffff` / `--popover-foreground` `#080808` | |
| `--border` | `#d8d8d8` | hairline |
| `--input` | `#d8d8d8` | hairline |
| `--ring` | `#146ef5` | 포커스 링 = info blue |
| `--destructive` | `#ee1d36` / `--destructive-foreground` `#ffffff` | accent-red |
| `--radius` | `0.5rem` (8px) | 카드 기준; 버튼은 4px override |

> shadcn 최신(Tailwind v4)은 hex/oklch 직접 사용 가능. HSL 프로젝트면 동일 색을 HSL로 변환해 넣는다.

## 2. 타이포그래피 (Pretendard로 계승)

- **폰트:** Pretendard (`next/font/local`로 번들, `--font-pretendard`).
  - fallback: `Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif`
  - 모노(코드/기술 캡션 드물게): `ui-monospace, SFMono-Regular, Menlo, monospace`
- **weight 상한 600.** 700+ 사용 금지.
- **display 사이즈에 음수 tracking.** 80px에서 -0.8px.
- 스케일(원본 그대로, 폰트만 Pretendard):

| 토큰 | size | weight | line-height | tracking | 용도 |
|------|------|--------|-------------|----------|------|
| `display-xxl` | 80px | 600 | 83.2px | -0.8px | 랜딩 히어로 (앱에선 드묾) |
| `display-xl` | 56px | 600 | 58.24px | 0 | |
| `display-lg` | 44.8px | 600 | 46.6px | 0 | 큰 섹션 제목 |
| `display-md` | 32px | 500 | 41.6px | 0 | 페이지 제목 |
| `display-sm` | 24px | 500 | 31.2px | 0 | 카드/패널 제목 |
| `display-xs` | 20px | 500 | 28px | 0 | 소제목 |
| `eyebrow-uppercase` | 15px | 500 | 19.5px | 1.5px | 섹션 위 UPPERCASE 라벨 |
| `eyebrow-uppercase-sm` | 12px | 500 | 12px | 0.6px | 작은 메타 라벨 |
| `body-lg` | 28.8px | 400 | 46.08px | -0.288px | 리드 문단 |
| `body-md` | 16px | 400 | 25.6px | -0.16px | 기본 본문 |
| `body-md-strong` | 16px | 500 | 25.6px | -0.16px | 강조 본문 |
| `body-sm` | 14px | 400 | 22.4px | 0 | 보조 본문 |
| `body-sm-strong` | 14px | 500 | 22.4px | 0 | 네비 링크/캡션 강조 |
| `caption` | 12.8px | 550 | 15.36px | 0 | 뱃지 라벨 (시그니처 550) |
| `button-md` | 16px | 500 | 25.6px | -0.16px | 버튼 라벨 |

> Pretendard는 가변 weight 지원 → 550 caption도 가능. 안 되면 500으로 폴백.

## 3. 스페이싱 (4px 베이스)

`xxs` 2 · `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 20 · `2xl` 24 · `3xl` 32 (px)

- 카드 내부 패딩: `3xl`(32). 섹션 거터: `3xl`(32).
- 입력/버튼 패딩: 버튼 `md xl`(12/20), 입력 `md lg`(12/16).

## 4. 라운드

`none` 0 · `xs` 2 · `sm` **4(버튼·뱃지·입력)** · `md` **8(카드·패널·모달)** · `full` 9999(원형 아이콘 버튼 only).
**Pill CTA 금지.**

## 5. 엘리베이션 (레이어드 드롭섀도우 — 브랜드 시그니처)

| 레벨 | 처리 | 용도 |
|------|------|------|
| 0 Flat | 그림자/보더 없음 | 기본 밴드 |
| 1 Hairline | `1px solid #d8d8d8` | 기본 카드·입력 chrome |
| 2 Layered | `0 84px 24px rgba(0,0,0,0), 0 54px 22px rgba(0,0,0,.01), 0 30px 18px rgba(0,0,0,.04), 0 13px 13px rgba(0,0,0,.08), 0 3px 7px rgba(0,0,0,.09)` | 떠보이는 카드(코멘트 팝오버 등) |
| 3 Layered Strong | 레벨2 + 마지막 stop opacity `.12` | 강조 패널 |
| 4 Heavy Modal | `0 24px 24px rgba(0,0,0,.26), 0 6px 13px rgba(0,0,0,.29)` | 모달/다이얼로그 |

## 6. 컴포넌트 (shadcn 매핑 + 우리 앱 적용)

원칙: **가능한 건 shadcn/ui 컴포넌트로**, 위 토큰으로 테마. 버튼은 라운드 4px override.

| 우리 앱 요소 | shadcn 베이스 | 스타일 규칙 | 사용처 |
|--------------|---------------|-------------|--------|
| 주 버튼 | `Button` (default) | bg `#080808`, text white, 4px, `button-md`, pad `12/20` | 시안 생성·저장·승인 |
| 보조 버튼 | `Button` (outline) | bg white, text ink, `1px #d8d8d8`, 4px | 취소·보조 액션 |
| 텍스트/링크 버튼 | `Button` (ghost/link) | 보더 없음, ink, 밑줄+화살표 | 더보기·인라인 링크 |
| 원형 아이콘 버튼 | `Button` (icon) | bg white, `rounded-full`, ink 아이콘 | **슬라이드 ◀▶ · 캔버스 줌 ＋－** |
| 입력 | `Input`/`Textarea` | bg white, `1px #d8d8d8`, 4px, `body-md`, pad `12/16`, placeholder `#ababab` | 로그인·비번·코멘트·채팅 |
| 카드/패널 | `Card` | bg white, hairline, 8px, pad `32`, 필요시 레벨2 섀도우 | 시안 카드·설정 패널 |
| 인증 카드 | `Card` + `Input` (ex-auth-form-card) | feature-card chrome | 로그인/가입 |
| 데이터 테이블 | `Table` (ex-data-table-cell) | header `caption`·UPPERCASE, body `body-sm`, row border hairline | **시안 리스트·관리자 사용자 목록·버전 히스토리** |
| 사이드바 행 | (ex-app-shell-row) | bg white, active indicator `#080808`, 4px, pad `12/16` | 대시보드 좌측 네비 |
| 모달 | `Dialog` (ex-modal-card) | 8px, 레벨4 섀도우 | 비번 설정·삭제 확인·버전 복원 확인 |
| 토스트 | `Sonner`/`Toast` (ex-toast) | white, 8px, 레벨2~3, `body-sm` | 저장됨·승인됨 알림 |
| 뱃지 | `Badge` (badge-info / -soft) | `caption`(12.8/550), 4px | **공개상태·역할·resolved 상태** |
| 상단 네비 | (nav-bar) | bg white, ink, pad `16/32`, sticky | 전역 헤더 |

### 6.1 뱃지 색 매핑 (시맨틱)

| 상태 | 색 |
|------|----|
| public(비번X) | `accent-green` (success) |
| public+비번 | `accent-yellow` (warning) |
| private | `mute`/hairline (중립) |
| role: admin | `accent-purple` |
| role: editor | `accent-blue-info` |
| role: pending | `accent-yellow` |
| comment resolved | `accent-green` / unresolved | `accent-orange` |

### 6.2 실시간 커서 색

접속 순서대로 `accent-purple → pink → blue → orange → green` 순환 배정. 커서 라벨 칩도 같은 색, 텍스트는 green일 때만 ink(가독성), 나머지는 white.

## 7. 프리뷰/캔버스 배경 (앱 특수 영역)

- **풀스크린 슬라이드:** 이미지 뒤 배경 = `canvas`(white). 1920 이미지가 흰 바탕 위에 놓임.
- **캔버스 뷰(Figma 스타일):** 배경 = `surface-soft`(`#f7f7f7`) 또는 약간 더 진한 중립 그레이 → 페이지 경계가 보이도록. 페이지에는 hairline 보더 + 레벨1.
- 핀 코멘트 마커: `accent-orange`(미해결) / `accent-green`(해결), 원형, 레벨2 섀도우.

## 8. Do / Don't (앱 맥락으로 적응)

**Do**
- `#080808`를 주 CTA·제목·로고에 예약. near-black이 전환색.
- 5색 액센트는 **커서·뱃지·아바타**에. 버튼 배경으로 쓰지 않음.
- display는 weight 600 + 음수 tracking, eyebrow는 UPPERCASE 1.5px.
- 버튼 4px, 카드/모달 8px. 떠야 하는 면엔 레이어드 섀도우.

**Don't**
- weight 700+ 금지(상한 600).
- 액센트색을 버튼 배경으로 쓰지 않음(면 채움/상태 표시용).
- Pill CTA 금지(4px 직사각).
- 6번째 액센트 도입 금지(5-stop이 시스템).
