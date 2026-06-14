# uxis-live-design — 설계 문서

> 시안(디자인 제안) 관리 + 실시간 회의 협업 툴
> 작성일: 2026-06-15

## 1. 개요

디자인 시안을 업로드/버전관리하고, 공개 링크로 공유하며, 캔버스 위에서
실시간으로 회의(커서·코멘트·채팅)하는 웹 서비스.

- 편집자는 가입 후 관리자 승인을 받아 시안을 업로드/수정한다.
- 일반 사용자는 로그인 없이 공개 시안을 URL로 열람한다.
- 공개 시안에는 선택적으로 비밀번호를 걸 수 있다(비번은 구두로 전달).

## 2. 기술 스택

| 영역 | 선택 |
|------|------|
| 프레임워크 | Next.js (App Router) + TypeScript |
| 데이터 접근 | **전부 Next.js API Route 경유 (BFF). 브라우저 → Supabase 직결 금지** |
| 권한 | **API route(1차) + Postgres RLS(2차) 2중 체크** |
| DB | Supabase Postgres |
| ORM | **Drizzle** (`drizzle-orm` + `drizzle-kit`), 드라이버 `postgres-js` |
| DB 연결 | Supabase **Transaction pooler** (port 6543, `prepare:false`) via `DATABASE_URL` |
| 인증 | Supabase Auth (이메일/비번 + 이메일 인증 + 관리자 승인) |
| 이미지 저장 | Supabase Storage (**비공개 버킷**, signed URL로만 노출) |
| 실시간 | Supabase Realtime (Presence + Broadcast) — 공식 문서 패턴 그대로 |
| UI | **shadcn/ui** (Radix + Tailwind) 최대 활용 |
| 폰트 | **Pretendard** (`next/font/local` 번들) |
| 배포 | Vercel + Supabase Cloud |

**디자인 시스템:** `docs/design-system.md` 참조 — `DESIGN-webflow.md`(Webflow 디자인 언어)를
본 스택에 적응한 토큰/컴포넌트 규칙. 핵심: near-black `#080808` 주색 + white 캔버스 + hairline 보더 +
4px 버튼/8px 카드 + 레이어드 드롭섀도우, **폰트는 Pretendard로 교체**, 5색 액센트는
**실시간 커서·상태 뱃지**로 재매핑. 모든 UI는 위 토큰으로 테마한 shadcn/ui로 구성.

## 3. 아키텍처 원칙

### 3.1 BFF (Backend-For-Frontend)

```
브라우저  →  Next.js API Route (권한 체크 1차)  →  Supabase (RLS 권한 체크 2차)
```

- 클라이언트는 데이터 용도로 Supabase 클라이언트를 들지 않는다.
  모든 CRUD/조회/업로드/비번해제/signed URL 발급은 API route(또는 server action)를 거친다.
- **권한 체크 (defense in depth)** — DB 접근은 전부 **Drizzle**로 한다.
  1. **API route (1차·주 enforcement):** 세션 확인 + 역할/소유권/공개여부를 코드로 체크하고,
     Drizzle 쿼리를 권한에 맞게 좁혀서 실행. **실질적 단일 관문.**
  2. **RLS (2차·하드 백스톱):** 모든 테이블에 RLS + `FORCE ROW LEVEL SECURITY`를 켜고
     `anon`/`authenticated`(PostgREST·Realtime) 역할은 **기본 deny**.
     단, Drizzle은 `DATABASE_URL`로 privileged 역할 직결이라 RLS가 매 요청을 게이트하지 **않는다** →
     RLS는 "publishable 키로의 직접 접근 / 오설정 / Realtime 구독"을 막는 **사고 방지 백스톱** 역할.
- `service`(secret) 키는 Storage signed URL 발급, 관리자성 작업 등에서만 **명시적 권한 체크 뒤에** 제한적으로 사용.
- Supabase Auth(로그인/세션)는 `@supabase/ssr`로 브라우저가 **인증 용도로만** publishable 키 사용
  (데이터 직결 아님 — BFF 원칙 유지).

### 3.2 Realtime 예외 (Supabase 공식 패턴 그대로)

Realtime은 본질적으로 브라우저 ↔ Supabase WebSocket 직결이라 BFF의 예외로 둔다.
단, **데이터 영속화는 여전히 API route 경유**를 유지한다.

| 기능 | 방식 | 저장 |
|------|------|------|
| 마우스 커서 | Supabase Realtime **Presence** (공식 cursor 예제) — 브라우저 직결 | 저장 안 함 |
| 채팅 | Supabase Realtime **Broadcast** (공식 chat 예제) — 브라우저 직결, 라이브 전송 | 라이브는 broadcast, **기록은 `chat_messages` 테이블에 저장** |
| 핀 코멘트 | 저장은 **API route 경유(BFF)** + 저장 후 broadcast로 라이브 반영 | `comments` 테이블 |

- Realtime 접속 토큰은 Next.js API route(`/api/realtime/token`)가 발급한 짧은 수명 토큰으로,
  채널을 시안별로 한정한다.

### 3.3 환경변수 / 시크릿 관리

- **실제 값은 절대 커밋 금지.** `.env.local`(git 무시)에만 둔다. `.env.example`(커밋)엔 placeholder만.
- `.gitignore`에 `.env*.local` 포함 — 첫 scaffold 시 최우선 처리.
- 채팅 등으로 노출된 키/비번은 셋업 후 **로테이션** 권장.

| 변수 | 위치 | 용도 |
|------|------|------|
| `DATABASE_URL` | 서버 | Drizzle → Supabase Transaction pooler (`postgresql://postgres.<ref>:<PW>@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`) |
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 | Supabase 프로젝트 URL (Auth/Realtime) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 | `sb_publishable_…` — Auth/Realtime 클라이언트 (공개 안전) |
| `SUPABASE_SECRET_KEY` | **서버 전용** | `sb_secret_…` — Storage signed URL·관리자성 작업 (절대 노출 금지) |

## 4. 권한 / 역할 모델

### 4.1 역할

| 역할 | 설명 |
|------|------|
| `pending` | 가입 직후. 아무 권한 없음(승인 대기) |
| `editor` | 승인된 편집자. **모든 시안**을 보고 생성/수정/삭제 가능(글로벌 권한) |
| `admin` | editor 권한 + 가입 승인 / 역할 변경 가능 |

- **관리자 부트스트랩:** 전원 `pending`으로 시작. 첫 관리자만 Supabase 대시보드에서 수동으로
  `admin` 지정. 이후부터는 앱 안에서 admin이 승인/승격 처리.
- 관리자는 여러 명 가능. admin이 다른 사용자를 admin으로 승격 가능.

### 4.2 시안 접근 단계

| 상태 | 누가 볼 수 있나 | 로그인 | 비밀번호 |
|------|----------------|--------|----------|
| `private` | 승인된 editor/admin만 | 필요 | — |
| `public` (비번 없음) | 링크 아는 누구나 | 불필요 | 없음 |
| `public` + 비번 | 링크 + 비밀번호 아는 누구나 | 불필요 | 필요 |

- 데이터 모델: `visibility: private | public` + `access_password_hash`(공개일 때만 선택).
  비번은 공개 시안에만 의미 있음(비공개는 이미 로그인 게이트가 있음).

### 4.3 비밀번호 보호 보안 설계

비번을 몰라도 이미지 원본 URL만 알면 보이는 사고를 막기 위해:

1. 모든 시안 이미지는 **비공개 Storage 버킷**에 저장. 직접 URL 접근 불가.
2. 이미지는 항상 **서버가 만든 signed URL**(짧은 만료)로만 노출.
3. 비밀번호 검증은 서버에서:
   - 시안에 `access_password_hash`(해시) 저장. 평문 저장 금지.
   - 뷰어가 비번 입력 → 서버 액션이 해시 대조 → 맞으면 **그 시안에만 유효한 서명 쿠키(HttpOnly)** 발급
   - 이후 그 쿠키가 있어야 서버가 데이터 + signed URL을 내려줌
4. RLS: `private` = editor/admin만, `public`(비번 없음) = anon 조회 허용,
   `public`+비번 = anon 직접 조회 차단(서버 게이트 + service role 경유).
5. 비번은 구두 전달. 이메일 발송 기능 없음. 편집자가 시안 설정에서 **걸기/풀기/바꾸기**만 제공.

### 4.4 권한 매트릭스

| 동작 | anon(공개·비번X) | anon(공개+비번, 해제후) | editor/admin |
|------|:--:|:--:|:--:|
| 공개 시안 보기 | O | O(서버 게이트) | O |
| 비공개 시안 보기 | X | X | O |
| 시안 생성/수정/삭제 | X | X | O(전체) |
| 버전 올리기/복원 | X | X | O |
| 코멘트/채팅 작성 | O(게스트 이름) | O(게스트 이름) | O |
| 가입 승인·역할변경 | X | X | admin만 |

- **코멘트/채팅 작성:** 시안을 볼 수 있는 사람은 누구나 작성 가능(실시간 회의 취지).
  게스트는 이름만 입력(아래 4.5).

### 4.5 게스트 이름 (lazy 입력)

- 주소로 접속하면 **이름 안 묻고 바로 열람** 가능.
- 코멘트/채팅을 **처음 작성하려 할 때** 그 자리에서 이름 입력(인라인, 모달 강제 X).
- 입력한 이름은 **localStorage 저장** → 다음 접속 땐 안 물음.
- 이름 정하기 전 커서는 자동 게스트 라벨/색, 이름 정하면 그때부터 이름 표시.

## 5. 데이터 모델

> 모든 테이블은 **Drizzle 스키마(`drizzle/schema.ts`)** 로 정의하고 `drizzle-kit`으로 마이그레이션.
> RLS 정책은 커스텀 SQL 마이그레이션으로 추가(3.1 백스톱).

```
profiles                  사용자 (auth.users 확장)
├─ id            uuid PK  (= auth.users.id)
├─ email         text
├─ display_name  text
├─ role          text     'pending' | 'editor' | 'admin'  (기본 pending)
├─ approved_at   timestamptz null
├─ approved_by   uuid null → profiles
└─ created_at    timestamptz

proposals                 시안
├─ id                   uuid PK
├─ public_id            text UNIQUE   짧은 랜덤코드 (URL용, /p/a7k2mq)
├─ title                text          (중복 허용)
├─ owner_id             uuid → profiles
├─ visibility           text          'private' | 'public'  (기본 private)
├─ access_password_hash text null     공개+비번일 때만
├─ current_version_id   uuid null → proposal_versions   기본 보여줄 버전
├─ created_at / updated_at  timestamptz

proposal_versions         버전 스냅샷 (히스토리)
├─ id          uuid PK
├─ proposal_id uuid → proposals
├─ version_no  int        1,2,3… (proposal별)
├─ note        text null  변경 메모
├─ created_by  uuid → profiles
├─ created_at  timestamptz
└─ UNIQUE(proposal_id, version_no)

proposal_pages            시안 이미지(페이지) — 버전에 속함
├─ id           uuid PK
├─ version_id   uuid → proposal_versions
├─ page_order   int
├─ storage_path text       비공개 버킷 경로
├─ width/height int        원본 크기 (보통 1920 폭)
└─ UNIQUE(version_id, page_order)

comments                  핀 코멘트
├─ id          uuid PK
├─ proposal_id uuid → proposals
├─ page_id     uuid → proposal_pages   (어느 페이지)
├─ parent_id   uuid null → comments    (답글 스레드)
├─ author_id   uuid null → profiles
├─ author_name text                    (게스트 표시용)
├─ body        text
├─ x / y       real                    0~1 정규화 좌표 (줌 무관)
├─ resolved    boolean (기본 false)
└─ created_at / updated_at  timestamptz

chat_messages             시안별 채팅 기록
├─ id          uuid PK
├─ proposal_id uuid → proposals
├─ author_id   uuid null → profiles
├─ author_name text
├─ body        text
└─ created_at  timestamptz
```

**설계 메모**

- 코멘트는 `page_id`로 **버전 스냅샷**에 붙는다 → 새 버전을 올리면 옛 코멘트는 옛 버전에 남아
  스냅샷 일관성 유지. 채팅은 버전 무관하게 시안 단위.
- 마우스 커서는 저장하지 않음(Realtime presence, 휘발).
- `public_id`는 충돌 검사 후 짧은 랜덤코드 생성(6~8자). 화면엔 "이름 + ID" 같이 표시.

## 6. 프리뷰 UX

상단에 **[전체 풀화면] / [캔버스 뷰]** 토글 버튼.

### 6.1 전체 풀화면 (슬라이드)

- 한 번에 한 페이지, **클릭하면 다음 장**(키보드 ←/→, 페이지 인디케이터 `3/12`).
- **핵심 — 이미지는 항상 native 1920px 폭 그대로, 절대 축소 안 함**(1:1, 화질 손실 없음).
- 세로로 긴 시안은 세로 스크롤, **스크롤바 폭 0(숨김)** 처리 → 스크롤바가 가로 공간을 먹어
  1920 이미지가 찌그러지거나 가로스크롤 생기는 것 방지(이 동작이 핵심 요구사항).
- 1920보다 좁은 화면에서는 **축소 대신 가로 넘침(오른쪽 잘림)**. "절대 축소 금지"가 우선.
  (1920+ 모니터 사용 전제)

### 6.2 캔버스 뷰 (Figma 스타일)

- 모든 페이지를 무한 캔버스에 펼침. 드래그로 이동(pan) + 스크롤로 줌(zoom).
- 페이지는 순서대로 배치(가로 한 줄 기본).
- 여기서 실시간 회의: 접속자 커서(presence), **클릭해서 핀 코멘트 꽂기**, 채팅 패널.
- 줌과 무관하게 핀 위치 정확(좌표 0~1 정규화 저장).

## 7. 단계별 구현 계획

각 단계는 별도의 구현 plan → 구현 사이클을 돈다.

### Phase 1 — 인증 & 시안 관리 (기반)

- Supabase 프로젝트, 전체 스키마 마이그레이션 + RLS 정책
- 이메일 가입/로그인, `pending` 상태, 관리자 승인 UI, 역할변경(editor/admin)
- 시안 CRUD, `public_id` 생성, 이미지 업로드(비공개 버킷), v1 자동 생성
- 버전 히스토리(목록 / 특정 버전 보기 / 복원), 시안 리스트
- 공개/비공개/비번 설정, 공개 뷰어 라우트 `/p/[publicId]` + 비번 게이트 + signed URL(최소 렌더)
- BFF API route + 2중 권한 체크, shadcn/ui 기본 셋업, Pretendard 폰트

### Phase 2 — 프리뷰 UX

- 풀스크린 슬라이드(1920 고정·스크롤바 숨김·클릭 넘김·키보드·인디케이터)
- 캔버스 뷰(pan/zoom, 페이지 배치)
- 상단 토글

### Phase 3 — 실시간 회의

- 커서(Presence) · 채팅(Broadcast + `chat_messages` 기록) — Supabase 문서 패턴 그대로
- 핀 코멘트(API route 저장 + broadcast, 스레드/resolved)
- 게스트 이름 lazy 입력, 채팅 기록 보기

## 8. 폴더 구조 (App Router)

```
app/
├─ (auth)/ login · signup
├─ (dashboard)/                  편집자/관리자(인증 필요)
│  ├─ proposals/ (리스트 · new · [id] 편집/버전/설정)
│  └─ admin/users/               가입 승인·역할
├─ p/[publicId]/                 공개 뷰어 (+ unlock 비번 게이트)
├─ api/                          BFF: proposals·comments·chat·admin·realtime/token
└─ layout.tsx
components/  preview/ · collab/ · ui/(shadcn)
lib/         db/(drizzle 클라이언트) · supabase/(auth·storage·realtime·service) · auth/ · access/ · realtime/
drizzle/     schema.ts(전체 테이블) · migrations/ · (RLS는 커스텀 SQL 마이그레이션)
drizzle.config.ts
supabase/    config.toml (로컬 개발 선택)
middleware.ts                    세션 리프레시·보호 라우트
.env.local (git 무시) · .env.example (커밋, placeholder)
```
