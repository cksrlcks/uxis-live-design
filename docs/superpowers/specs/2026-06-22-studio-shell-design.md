# 전면 리디자인 — 1. 스튜디오 셸 스펙

> 작성일: 2026-06-22
> 상위 방향: GitGuardian 풍 대시보드 전면 개편 (블루 주색 · 보더 주도 플랫 · 그레이 2계층 캔버스)
> 선행: 하위작업 0(파운데이션 토큰/뱃지) 완료. 이 문서는 **하위작업 1(스튜디오 셸)** 범위만 다룬다.
> 후속: ② 대시보드 홈 · ③ 시안 목록 재구성 · ④ 상세+사용자 관리 폴리시 (각 별도 스펙)

## 1. 목표 / 배경

현재 `/studio/*` 화면 전부가 공유하는 셸(`app/studio/layout.tsx`)이 **텍스트 링크만 있는
미니멀 사이드바 + 흰 배경**뿐이다. 파운데이션(블루 주색·시맨틱 필)은 깔렸지만 셸이 그
토큰을 거의 안 쓴다. 이것이 "단조로움"의 실체다.

이 작업은 모든 스튜디오 화면이 얹히는 **셸 골격**을 디자인 시스템 v2(대시보드 방향)로
세운다. 셸 하나만 바꿔도 전 화면이 즉시 SaaS 톤으로 올라가고, 이후 ②③④가 같은 규칙 위에
얹힌다. 브레인스토밍에서 사용자가 비주얼 컴패니언으로 확정한 결정:

- **확장 사이드바(A안)** — 워크스페이스 마크 + 아이콘·라벨 네비 + 블루 액티브
- **캔버스 내 페이지 헤더(패턴 1)** — 얇은 브레드크럼 상단바 + 캔버스 안 아이브로우/제목/메타/우측 액션

## 2. 범위

**손대는 파일 (신규)**

- `src/widgets/studio-shell/ui/studio-shell.tsx` — 셸 프레임(그리드 + 그레이 캔버스). 서버 컴포넌트.
- `src/widgets/studio-shell/ui/studio-sidebar.tsx` — 사이드바(`"use client"`, 액티브=`usePathname`).
- `src/widgets/studio-shell/ui/studio-topbar.tsx` — 상단 브레드크럼 바(`"use client"`).
- `src/widgets/studio-shell/ui/page-header.tsx` — 재사용 페이지 헤더(아이브로우/제목/메타/액션).
- `src/widgets/studio-shell/model/nav-config.ts` — 네비 항목 단일 출처(사이드바·브레드크럼 공용).
- `src/widgets/studio-shell/index.ts` — 배럴(`StudioShell`, `PageHeader`).

**손대는 파일 (수정)**

- `app/studio/layout.tsx` — 인라인 베어 사이드바 제거, `<StudioShell>`로 교체(인증 가드는 유지).
- `src/pages/proposals-list/ui/proposals-list-page.tsx` — `<h1>`→`<PageHeader>`, 테이블을 흰 카드 surface로 감쌈.
- `src/pages/admin-users/ui/admin-users-page.tsx` — 동일(헤더+카드 surface). 역할 뱃지는 `neutral` 필로.
- `app/studio/styles` 불필요 — 그레이 캔버스는 셸 컨테이너 className에 국한(전역 `--background` **불변**).
- `docs/design-system.md` — v2 절의 Sidebar/Breadcrumb/PageHeader 항목에 확정 값 기입.

**비목표 (후속 하위작업)**

- 대시보드 홈(통계 카드)·`/studio` 라우트 변경 → **②**. 지금 `/studio`는 그대로 `/studio/proposals`로 리다이렉트.
- 시안 목록의 본격 재구성(툴바/검색/썸네일 갤러리/빈 상태) → **③**. 이번엔 기존 테이블을 카드로 감싸는 정도만.
- 우측 **DetailPanel** → **④**(상세 화면 전용이라 셸 아님).
- 워크스페이스 **스위처 드롭다운**·상단 검색/도움말 실기능 → 후속. 이번엔 마크/슬롯만(비기능).
- 공개 뷰어(`/p`)·인증·`/pending`·홈 → 셸 미적용. 흰 배경 유지(회귀 방지).

## 3. 아키텍처

```
app/studio/layout.tsx  (RSC, 인증 가드)
   └─ <StudioShell displayName email role>      ← src/widgets/studio-shell
         ├─ <StudioSidebar …>   "use client"  (워크스페이스 마크 · 네비 · 유저 푸터)
         └─ <main> (그레이 캔버스)
              ├─ <StudioTopbar>  "use client"  (브레드크럼 · 우측 슬롯)
              └─ {children}                     ← 각 페이지가 <PageHeader/> + 흰 카드 surface 렌더
```

- **경계:** 레이아웃(서버)은 인증·프로필 조회만. 셸은 프로필에서 **필요한 필드만**(`displayName`,
  `email`, `role`) 평면 props로 받아 클라이언트 경계로 넘긴다(Profile 객체 통째 전달 금지).
- **네비 단일 출처:** `nav-config.ts`의 배열을 사이드바(렌더+액티브)와 토프바(브레드크럼 라벨)가
  공유 → 라우트/라벨이 한 곳에서만 정의됨.

### 3.1 nav-config.ts

```ts
import { Layers, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;        // 섹션 루트
  label: string;       // 사이드바 라벨 + 브레드크럼 섹션명
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/studio/proposals", label: "시안", icon: Layers },
  { href: "/studio/users", label: "사용자 관리", icon: Users, adminOnly: true },
];

// 액티브: 현재 경로가 항목 href로 시작하면 활성(`/studio/proposals/123`도 "시안" 활성)
export const matchNav = (pathname: string) =>
  NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
```

## 4. 상세 디자인

### 4.1 셸 프레임 (studio-shell.tsx) — 그레이 2계층

```
<div class="flex min-h-screen bg-muted text-foreground">   // 앱 캔버스 = 옅은 그레이(#f7f7f7)
  <StudioSidebar/>                                          // 흰색 + border-r
  <div class="flex min-w-0 flex-1 flex-col">
    <StudioTopbar/>                                         // sticky 흰/블러
    <main class="flex-1 px-8 py-7">{children}</main>        // 투명(그레이 위)
  </div>
</div>
```

- **앱 캔버스 = `bg-muted`(#f7f7f7).** 전역 `--background`(흰색)는 안 건드림 → 뷰어/인증 회귀 0.
  카드는 흰색이라 hairline 보더 + 미세 그림자로 떠 보인다. (테스트에서 대비가 약하면 `#f5f6f8`
  쿨그레이로 1단계 조정 — 디자인 시스템에 반영.)
- 본문 패딩 `px-8 py-7`(32/28).

### 4.2 사이드바 (studio-sidebar.tsx) — 폭 `w-56`(224px), 흰색, `border-r`

세로 구성(위→아래):

1. **워크스페이스 마크** — 블루 라운드 사각(8px) 안 머리글자 `U` + `uxis` / 보조 `live design`
   + `▾`(장식, 비기능). `flex` 한 줄, hairline 보더 박스(`rounded-lg border p-2`). 클릭 시 `/studio`로.
2. **그룹 라벨** — `워크스페이스`, eyebrow-uppercase-sm(12px, tracking, `text-muted-foreground`).
3. **네비** — `NAV_ITEMS`를 role로 필터(`adminOnly`는 admin만). 각 행:
   - 기본: `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/80 hover:bg-muted`
   - 아이콘 `size-4`(lucide), 라벨.
   - **액티브**(`matchNav`): `bg-primary/10 text-primary font-medium` + 좌측 3px 블루 인디케이터
     (`before:` 가상요소, `rounded-r`). 아이콘도 `text-primary`. (`bg-primary/10`은 뱃지 `info`의
     `bg-info/10`과 동일한 틴트 규칙 — 하드코딩 hex 대신 토큰 사용.)
4. `flex-1` 스페이서.
5. **유저 푸터** — `border-t pt-3`: 아바타(원형, 그라데이션 또는 머리글자) + `displayName ?? "사용자"`
   / `email`(truncate). 그 아래 기존 `<LogoutButton>`(outline, `className="w-full"`).
   - 드롭다운 계정 메뉴는 후속. 이번엔 정보+로그아웃 버튼만(기능 안전 우선).

### 4.3 상단바 (studio-topbar.tsx) — `h-12`, sticky, 흰/블러

- `sticky top-0 z-10 flex h-12 items-center justify-between border-b bg-background/80 px-6 backdrop-blur`.
- **좌측 브레드크럼:** `uxis`(루트, `/studio` 링크, `text-muted-foreground`) › **섹션명**(현재 매칭 항목
  라벨, `text-foreground font-medium`). 구분자 `›`. `matchNav(pathname)?.label`로 라벨 도출.
  - 동적 항목(시안 제목 등) 말단 크럼은 **미포함**(MVP) — 항목 제목은 캔버스의 PageHeader가 담당.
    추후 페이지가 말단 크럼을 주입하는 슬롯은 확장 여지로 남김.
- **우측 슬롯:** 이번엔 비워둠(예약). 검색/도움말 실기능은 후속.

### 4.4 페이지 헤더 (page-header.tsx) — 재사용

```tsx
type PageHeaderProps = {
  eyebrow?: string;        // 예: "워크스페이스"
  title: string;           // 예: "시안"
  description?: React.ReactNode; // 예: "전체 12 · 공개 5 · 비공개 7"
  actions?: React.ReactNode;     // 예: <Button>새 시안</Button>
};
```

- 레이아웃: `flex items-start justify-between` (좌: 텍스트 블록 / 우: actions). `mb-6`.
- 아이브로우: eyebrow-uppercase-sm, `text-muted-foreground`, `mb-1`.
- 제목: `text-2xl font-medium tracking-tight`(display-sm, weight 500 — weight 상한 600 준수).
- 설명: `text-sm text-muted-foreground mt-1`.
- actions 슬롯: 주 액션 버튼(블루 default). 모바일 좁을 때 줄바꿈 허용(`flex-wrap gap-3`).

### 4.5 흰 카드 surface (페이지가 콘텐츠를 감쌈)

- 테이블/목록은 `rounded-lg border bg-card overflow-hidden` 컨테이너로 감싼다(그레이 위에 뜨도록).
- 보더 주도 플랫(섀도우 없음 기본). 표 헤더는 디자인 시스템대로 caption·UPPERCASE.
- `proposals-list`/`admin-users`는 이번에 헤더를 `PageHeader`로, 표를 위 surface로만 교체.
  **표 구조·컬럼·기능은 그대로**(본격 재구성은 ③).

### 4.6 layout.tsx 교체 (after)

```tsx
export default async function StudioLayout({ children }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!isEditor(profile.role as Role)) redirect("/pending");
  return (
    <StudioShell
      displayName={profile.displayName}
      email={profile.email}
      role={profile.role as Role}
    >
      {children}
    </StudioShell>
  );
}
```

## 5. 검증 기준

- `/studio/proposals`, `/studio/users`가 새 셸로 렌더: 흰 사이드바(블루 액티브) + 그레이 캔버스 +
  브레드크럼 상단바 + 페이지 헤더 + 흰 카드 표.
- 현재 경로의 사이드바 항목이 블루로 활성, 좌측 인디케이터 표시. 사용자 관리는 **admin만** 노출.
- 브레드크럼이 `uxis › 시안` / `uxis › 사용자 관리`로 정확.
- 로그아웃 정상 동작(기존 동작 불변). 비-에디터는 여전히 `/pending`으로.
- 공개 뷰어(`/p/*`)·로그인·`/pending`은 **시각 변화 없음**(흰 배경 유지).
- `lint` · `tsc --noEmit` · 빌드 통과. `/studio/proposals` 200.

## 6. 미해결 / 가정

- 워크스페이스가 **단일**이라는 가정 → 마크는 비기능(스위처 후속). 다중 워크스페이스 도입 시 ①의 마크를
  드롭다운으로 승격.
- 그레이 캔버스 값은 `#f7f7f7`(디자인 시스템 surface-soft) 시작. 흰 카드와 대비가 약하면 `#f5f6f8`로
  조정하고 디자인 시스템에 기록.
- 아이콘은 lucide-react 사용(이미 의존성에 있음). 시안=`Layers`, 사용자=`Users` 가정(검토 후 교체 가능).
- 유저 푸터는 정보+로그아웃 버튼(MVP). 계정 드롭다운(dropdown-menu 기존 활용)은 폴리시 단계 후보.
