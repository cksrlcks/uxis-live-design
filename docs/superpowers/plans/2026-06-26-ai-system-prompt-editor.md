# AI 시스템 프롬프트 편집기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하드코딩된 AI 시스템 프롬프트를 DB로 이전하고, 스튜디오에서 관리자가 편집할 수 있는 설정 페이지를 제공한다.

**Architecture:** `ai_settings` 테이블(key-value)에 시스템 프롬프트를 저장. `getAiSystemPrompt()`가 DB를 읽어 `generate-html.server.ts`에 주입. Next.js 서버 컴포넌트가 초기값을 읽어 클라이언트 UI에 전달하고, Server Action으로 저장.

**Tech Stack:** Next.js (Server Components + Server Actions), Drizzle ORM, Supabase PostgreSQL, React Query (불필요 — 이번 기능은 단순 form이므로 사용 안 함), Vitest, sonner(toast)

## Global Constraints

- Node ≥ 22.0.0
- 마이그레이션은 손으로 작성 (`db:generate` 사용 금지 — 스냅샷이 stale)
- `drizzle/schema.ts`에 테이블 정의 추가 후 `drizzle/migrations/meta/_journal.json`에 수동 엔트리 추가
- `@drizzle/schema` alias = `drizzle/schema.ts`
- `@/shared/db` = Drizzle db 인스턴스
- 관리자 권한 체크: `requireAdmin()` from `@/shared/auth/guards.server`
- 모든 server-only 파일 최상단에 `import "server-only";`
- 테스트 파일 최상단에 `vi.mock("server-only", () => ({}))` 필수

---

## 파일 목록

| 파일 | 작업 |
|------|------|
| `drizzle/migrations/0025_ai_settings.sql` | 생성 |
| `drizzle/migrations/meta/_journal.json` | 수정 (엔트리 추가) |
| `drizzle/schema.ts` | 수정 (aiSettings 테이블 추가) |
| `src/entities/ai-design/api/ai-settings.server.ts` | 생성 |
| `src/entities/ai-design/api/generate-html.server.ts` | 수정 (SYSTEM_PROMPT 상수 제거 → DB 조회) |
| `tests/entities/ai-design/generate-html.server.test.ts` | 수정 (ai-settings mock 추가) |
| `src/pages/ai-design-settings/ui/ai-design-settings-page.tsx` | 생성 |
| `app/studio/ai-designs/settings/page.tsx` | 생성 |
| `src/pages/ai-designs/ui/ai-designs-page.tsx` | 수정 (Settings 버튼 추가) |

---

## Task 1: DB 마이그레이션 + Drizzle 스키마

**Files:**
- Create: `drizzle/migrations/0025_ai_settings.sql`
- Modify: `drizzle/migrations/meta/_journal.json`
- Modify: `drizzle/schema.ts`

**Interfaces:**
- Produces: `aiSettings` 테이블 export — `{ key: string, value: string, updatedAt: Date }`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`drizzle/migrations/0025_ai_settings.sql` 전체 내용:

```sql
CREATE TABLE "ai_settings" (
  "key"        text PRIMARY KEY,
  "value"      text NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO "ai_settings" ("key", "value") VALUES (
  'system_prompt',
  $$당신은 시니어 웹 디자이너 겸 프론트엔드 개발자입니다.
요구사항과 참고 이미지(기존 시안)를 분석해, 하나의 완결형 HTML 문서를 생성합니다.

다음 결과물은 AI가 자동으로 만든 듯한 과하게 정돈된 시안이 아니라,
실제 웹디자이너가 클라이언트 제안용으로 제작한 현실적인 웹 시안처럼 보여야 한다.

다음 순서로 정확히 출력하세요(이 외 설명/코드펜스 금지):
1) <분석>...</분석> — 참고 시안과 요구사항을 어떻게 이해했는지 2~3문장(한국어).
2) <도입>...</도입> — 참고 시안의 어떤 요소를 이번 시안에 어떻게 반영했는지 1~2문장(한국어).
3) '<!DOCTYPE html>'로 시작하는 단일 HTML 문서. 앞의 두 태그 뒤에 이어서 출력.

[중요한 디자인 방향]
- 참고 이미지 10개를 단순히 평균내거나 섞지 말고, 공통적으로 반복되는 레이아웃 질서, 여백감, 타이포 크기감, 이미지 사용 방식, 버튼 스타일, 섹션 리듬을 분석해서 반영한다.
- 선택된 태그는 디자인 방향을 결정하는 기준으로 사용하되, 태그명을 노골적으로 시각화하지 않는다.
- 너무 완벽하게 대칭적이거나 모든 섹션이 같은 패턴으로 반복되는 구성을 피한다.
- 섹션마다 약간의 밀도 차이, 여백 차이, 이미지 비율 차이를 두어 실제 사람이 디자인한 듯한 리듬을 만든다.
- 모든 요소를 카드, 둥근 모서리, 그라데이션, 글래스모피즘으로 처리하지 않는다.
- 불필요한 이모지, 과한 아이콘, 과장된 그림자, 지나치게 화려한 애니메이션은 사용하지 않는다.
- AI 생성물에서 흔히 보이는 보라색/파란색 그라데이션, 과한 glow 효과, 의미 없는 3D 오브젝트 배치는 피한다.
- 배경은 단순한 흰색 또는 연한 회색만 고집하지 말고, 브랜드/업종/태그에 맞는 절제된 색면, 이미지 영역, 여백 구조를 사용한다.
- 텍스트는 일반적인 마케팅 문구처럼 보이되, 너무 추상적인 표현만 반복하지 않는다.
- CTA 버튼은 과하게 많이 넣지 말고, 실제 서비스 페이지처럼 우선순위가 분명하게 배치한다.
- 콘텐츠 영역은 실제 운영 가능한 웹사이트처럼 구성한다. 의미 없는 더미 카드나 반복되는 "Feature 1, Feature 2"식 구조는 피한다.
- 이미지 영역은 단순 placeholder가 아니라 실제 시안에서 쓰일 법한 비율과 배치로 만든다.
- 폰트 크기, line-height, letter-spacing, font-weight는 섬세하게 조절해서 템플릿 느낌을 줄인다.
- 모바일 반응형도 고려하되, 데스크톱 시안의 완성도를 우선한다.

[피해야 할 AI스러운 패턴]
- 모든 섹션이 동일한 max-width, 동일한 border-radius, 동일한 box-shadow로 반복되는 것
- hero 영역에 큰 타이틀 + 설명 + 버튼 2개 + 오른쪽 카드 mockup만 있는 흔한 SaaS 구조
- 의미 없는 "혁신적인", "스마트한", "최고의 경험" 같은 추상 문구 반복
- 카드 3개/4개를 균등 배치하는 단순 반복형 레이아웃
- 과하게 둥근 pill 버튼, 보라-파랑 gradient, blur blob 배경
- 아이콘만 바뀌고 내용 구조가 같은 feature card 반복
- 모든 섹션을 중앙정렬로만 구성하는 것
- 이미지 없이 CSS 도형과 그라데이션만으로 꾸미는 것
- 실제 브랜드/서비스 맥락 없이 보기 좋은 UI 조각만 나열하는 것

[사람이 만든 시안처럼 보이게 하는 기준]
- 첫 화면에서 업종과 목적이 즉시 이해되어야 한다.
- 섹션 간 위계가 명확해야 한다.
- 주요 카피, 이미지, 버튼, 리스트, 배경 요소가 서로 역할을 가져야 한다.
- 여백은 넉넉하되 비어 보이지 않게 조정한다.
- 레이아웃은 정돈되어 있지만, 너무 기계적으로 반복되지 않게 한다.
- 참고 이미지의 분위기는 반영하되, 동일한 레이아웃을 복사하지 않는다.
- 실제 퍼블리싱 가능한 HTML/CSS 구조로 작성한다.

HTML 기술 규칙:
- CSS는 <style>에 인라인. 외부 스크립트/네트워크/폰트 CDN 의존을 최소화.
- 참고 이미지의 레이아웃/톤/구성요소를 참고하되 그대로 베끼지 말고 요구사항에 맞게 재구성.
- 색상은 절제하여 사용한다. primary·secondary를 정해 일관된 스타일 가이드를 따르고, 강조색은 1~2개로 제한한다.
- 모서리(border-radius)는 적당히 둥글게(약 6~10px). 버튼이 pill 형태이거나 과하게 둥근 모서리는 지양.
- 한국어 콘텐츠. 실제같은 더미 텍스트 사용.$$
);
```

- [ ] **Step 2: journal.json에 엔트리 추가**

`drizzle/migrations/meta/_journal.json`의 `entries` 배열 끝에 추가:

```json
{
  "idx": 25,
  "version": "7",
  "when": 1784000000000,
  "tag": "0025_ai_settings",
  "breakpoints": true
}
```

- [ ] **Step 3: drizzle/schema.ts에 테이블 추가**

파일 맨 끝에 추가 (마지막 `export type AiDesignReferenceProposal` 줄 아래):

```ts
// === AI 설정 (AI Settings) ===
export const aiSettings = pgTable("ai_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 4: 마이그레이션 적용**

```bash
pnpm db:migrate
```

Expected: "0025_ai_settings" 마이그레이션 적용 완료 메시지. 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add drizzle/migrations/0025_ai_settings.sql drizzle/migrations/meta/_journal.json drizzle/schema.ts
git commit -m "feat(ai-design): ai_settings 테이블 추가 + 업그레이드된 시스템 프롬프트 시드"
```

---

## Task 2: 서버 액션 + generate-html 수정

**Files:**
- Create: `src/entities/ai-design/api/ai-settings.server.ts`
- Modify: `src/entities/ai-design/api/generate-html.server.ts`
- Modify: `tests/entities/ai-design/generate-html.server.test.ts`

**Interfaces:**
- Consumes: `aiSettings` from `@drizzle/schema` (Task 1)
- Produces:
  - `getAiSystemPrompt(): Promise<string>` — DB에서 시스템 프롬프트 읽기
  - `updateAiSystemPrompt(content: string): Promise<void>` — 관리자 전용 upsert

- [ ] **Step 1: ai-settings.server.ts 작성**

`src/entities/ai-design/api/ai-settings.server.ts` 전체 내용:

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiSettings } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";

// DB에 행이 없을 때 생성을 중단시키지 않기 위한 안전장치.
const FALLBACK_SYSTEM_PROMPT =
  "당신은 시니어 웹 디자이너 겸 프론트엔드 개발자입니다. 요구사항에 맞는 HTML 시안을 생성하세요.";

export async function getAiSystemPrompt(): Promise<string> {
  const rows = await db
    .select({ value: aiSettings.value })
    .from(aiSettings)
    .where(eq(aiSettings.key, "system_prompt"))
    .limit(1);
  return rows[0]?.value ?? FALLBACK_SYSTEM_PROMPT;
}

export async function updateAiSystemPrompt(content: string): Promise<void> {
  await requireAdmin();
  await db
    .insert(aiSettings)
    .values({ key: "system_prompt", value: content })
    .onConflictDoUpdate({
      target: aiSettings.key,
      set: { value: content, updatedAt: new Date() },
    });
}
```

- [ ] **Step 2: generate-html.server.ts 수정 — SYSTEM_PROMPT 상수 제거 후 DB 조회로 교체**

`src/entities/ai-design/api/generate-html.server.ts`에서 다음을 변경한다.

import 목록에 추가:
```ts
import { getAiSystemPrompt } from "./ai-settings.server";
```

`const SYSTEM_PROMPT = [...].join("\n");` 블록(15~30번 줄) 전체를 삭제한다.

`generateHtml` 함수 내부에서 `system: SYSTEM_PROMPT` 를 `system: await getAiSystemPrompt()` 로 교체:

```ts
export async function generateHtml(
  input: GenerationInput,
  imageUrls: string[],
  model: string,
): Promise<GeneratedDesign> {
  const providerKey = PROVIDER_BY_MODEL[model] ?? AI_PROVIDER;
  const provider = PROVIDERS[providerKey];
  if (!provider) throw new Error(`UNKNOWN_AI_PROVIDER:${providerKey}`);

  const raw = await provider.generate({
    model,
    system: await getAiSystemPrompt(),
    userText: buildUserText(input),
    imageUrls,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });

  const result = parseGeneration(raw);
  if (!result.html) throw new Error("EMPTY_GENERATION");
  return result;
}
```

- [ ] **Step 3: generate-html 테스트에 ai-settings mock 추가**

`tests/entities/ai-design/generate-html.server.test.ts` 상단 mock 목록에 추가 (기존 `vi.mock("openai", ...)` 바로 아래):

```ts
vi.mock("@/entities/ai-design/api/ai-settings.server", () => ({
  getAiSystemPrompt: vi.fn().mockResolvedValue("test system prompt"),
}));
```

기존 테스트 케이스 `arg.instructions.toContain("HTML")` 검사는 mock 프롬프트("test system prompt")를 반환하므로 `"HTML"` 포함 여부 단언을 제거하거나 `"test system prompt"` 로 변경:

```ts
// 변경 전:
expect(arg.instructions).toContain("HTML");
// 변경 후:
expect(arg.instructions).toBe("test system prompt");
```

- [ ] **Step 4: 테스트 실행**

```bash
pnpm test tests/entities/ai-design/generate-html.server.test.ts
```

Expected: 3개 테스트 모두 PASS.

- [ ] **Step 5: 전체 테스트 통과 확인**

```bash
pnpm test
```

Expected: 기존에 실패하는 2건(`locate.test.ts`)을 제외하고 모두 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/entities/ai-design/api/ai-settings.server.ts src/entities/ai-design/api/generate-html.server.ts tests/entities/ai-design/generate-html.server.test.ts
git commit -m "feat(ai-design): 시스템 프롬프트를 DB에서 읽도록 generate-html 수정"
```

---

## Task 3: 설정 페이지 UI

**Files:**
- Create: `src/pages/ai-design-settings/ui/ai-design-settings-page.tsx`
- Create: `app/studio/ai-designs/settings/page.tsx`
- Modify: `src/pages/ai-designs/ui/ai-designs-page.tsx`

**Interfaces:**
- Consumes:
  - `getAiSystemPrompt()` (Task 2)
  - `updateAiSystemPrompt(content)` (Task 2) — Server Action으로 래핑
  - `PageHeader` from `@/widgets/studio-shell`
  - `Button` from `@/shared/ui/button`
  - `toast` from `sonner`
- Produces: `/studio/ai-designs/settings` 페이지, 목록 페이지 Settings 버튼

- [ ] **Step 1: 설정 페이지 클라이언트 컴포넌트 작성**

`src/pages/ai-design-settings/ui/ai-design-settings-page.tsx` 전체 내용:

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/widgets/studio-shell";
import { Button } from "@/shared/ui/button";

interface Props {
  initialPrompt: string;
  updatePrompt: (content: string) => Promise<void>;
}

export function AiDesignSettingsPage({ initialPrompt, updatePrompt }: Props) {
  const [value, setValue] = useState(initialPrompt);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await updatePrompt(value);
        toast.success("저장했습니다");
      } catch {
        toast.error("저장에 실패했습니다");
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="AI 생성 설정"
        description="AI가 HTML 시안을 생성할 때 사용하는 지침입니다. 변경 즉시 다음 생성부터 반영됩니다."
      />

      <div className="mb-2 flex items-center gap-1.5">
        <Link
          href="/studio/ai-designs"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4" />
          AI 시안 목록
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        <label className="text-sm font-medium" htmlFor="system-prompt">
          시스템 프롬프트
        </label>
        <textarea
          id="system-prompt"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="border-input bg-background text-foreground focus-visible:ring-ring w-full rounded-lg border px-3 py-2.5 font-mono text-sm leading-relaxed focus-visible:ring-2 focus-visible:outline-none"
          style={{ minHeight: "420px", resize: "vertical" }}
          disabled={isPending}
        />
        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 서버 컴포넌트 라우트 페이지 작성**

`app/studio/ai-designs/settings/page.tsx` 전체 내용:

```tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isAdmin, type Role } from "@/shared/auth/roles";
import { getAiSystemPrompt, updateAiSystemPrompt } from "@/entities/ai-design/api/ai-settings.server";
import { AiDesignSettingsPage } from "@/pages/ai-design-settings/ui/ai-design-settings-page";

export default async function Page() {
  const profile = await getProfile();
  if (!profile || !isAdmin(profile.role as Role)) redirect("/studio");

  const prompt = await getAiSystemPrompt();

  async function updatePrompt(content: string) {
    "use server";
    await updateAiSystemPrompt(content);
  }

  return <AiDesignSettingsPage initialPrompt={prompt} updatePrompt={updatePrompt} />;
}
```

- [ ] **Step 3: 목록 페이지 헤더에 Settings 버튼 추가**

`src/pages/ai-designs/ui/ai-designs-page.tsx` 상단 import에 추가:

```ts
import Link from "next/link";
import { Settings } from "lucide-react";
```

(이미 `Link`가 import되어 있으므로 `Settings`만 lucide import에 추가한다.)

`PageHeader`의 `actions` prop에 Settings 링크 버튼을 추가한다. 기존 코드:

```tsx
actions={
  <Button type="button" onClick={() => setCreateOpen(true)}>
    <Plus />
    생성하기
  </Button>
}
```

변경 후:

```tsx
actions={
  <div className="flex items-center gap-2">
    <Button type="button" variant="ghost" size="icon" asChild>
      <Link href="/studio/ai-designs/settings" aria-label="AI 생성 설정">
        <Settings className="size-4" />
      </Link>
    </Button>
    <Button type="button" onClick={() => setCreateOpen(true)}>
      <Plus />
      생성하기
    </Button>
  </div>
}
```

- [ ] **Step 4: 빌드 타입 체크**

```bash
pnpm build
```

Expected: 타입 에러 없이 빌드 성공. (빌드 중 Supabase URL 미설정 경고는 무시 가능)

- [ ] **Step 5: 커밋**

```bash
git add src/pages/ai-design-settings/ui/ai-design-settings-page.tsx app/studio/ai-designs/settings/page.tsx src/pages/ai-designs/ui/ai-designs-page.tsx
git commit -m "feat(ai-design): 스튜디오 AI 시스템 프롬프트 편집 페이지 추가"
```

---

## 수동 검증 체크리스트

- [ ] `/studio/ai-designs` 접속 → 헤더 오른쪽에 톱니바퀴 아이콘 버튼이 보임
- [ ] 톱니바퀴 클릭 → `/studio/ai-designs/settings` 이동
- [ ] 페이지에 시드된 시스템 프롬프트가 textarea에 표시됨
- [ ] 내용 수정 후 "저장" 클릭 → "저장했습니다" 토스트
- [ ] 페이지 새로고침 → 수정된 내용이 유지됨
- [ ] AI 시안 생성 → 수정된 프롬프트가 반영된 결과물 확인
