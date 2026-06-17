# Refactor Stage 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the FSD `src/` structure, React Query / Zod / RHF / Prettier tooling, and shared infrastructure (query client, fetch wrapper, error mapping) **without changing any runtime behavior**, so subsequent stages can migrate domain slices onto the new architecture.

**Architecture:** Move `lib/` and `components/` into `src/legacy/` in one uniform relocation, flip the `@` alias to `src` (with `@drizzle` for the root schema), then promote genuinely-shared modules out of `legacy/` into FSD `shared/`. Add the React Query provider into the existing root layout (preserving `NuqsAdapter`). New shared logic (fetch wrapper, error→Response mapping, query client defaults, same-origin predicate) is built test-first.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts` middleware), React 19, Drizzle ORM, Supabase, Tailwind v4, Vitest, `@tanstack/react-query` v5, Zod, React Hook Form.

**Source spec:** `docs/superpowers/specs/2026-06-17-fsd-react-query-refactor-design.md` (Stage 0).

**Conventions for this plan:**
- This is a structural refactor. For pure relocations the "test" is the green gate: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. For new logic (Tasks 3–5) we use red-green TDD with Vitest.
- macOS/BSD environment: codemods use `perl -pi -e` (portable in-place edit).
- One commit per task.

---

### Task 1: Install dependencies + Prettier config

**Files:**
- Modify: `package.json` (deps + scripts)
- Create: `.prettierrc`
- Create: `.prettierignore`

- [ ] **Step 1: Install runtime + dev dependencies**

Run:
```bash
npm install @tanstack/react-query @tanstack/react-query-devtools zod react-hook-form @hookform/resolvers
npm install -D prettier prettier-plugin-tailwindcss server-only
```
Expected: installs succeed; `package.json` lists `@tanstack/react-query`, `zod`, `react-hook-form`, `@hookform/resolvers` in dependencies and `prettier`, `prettier-plugin-tailwindcss`, `server-only` in devDependencies.

> Why `server-only`: it is NOT a Next dependency — Next only aliases the bare `server-only` specifier to an internal stub at build/dev time, so it does NOT resolve under plain `tsc`/Vitest. Installing it as a dev dependency makes `import "server-only"` (used on `guards.server.ts`/`storage.ts` in Task 6, and on every `*.server.ts` in later stages) resolve for all tools, and pre-empts a Vitest "cannot resolve server-only" failure once Stage 1+ tests import guarded server modules.

- [ ] **Step 2: Create `.prettierrc`**

```json
{
  "plugins": ["prettier-plugin-tailwindcss"],
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all"
}
```

- [ ] **Step 3: Create `.prettierignore`**

```
node_modules
.next
package-lock.json
drizzle/migrations
src/legacy
```
(`src/legacy` is ignored so we do NOT reformat not-yet-migrated code — formatting happens per-file as each module is promoted in later stages.)

- [ ] **Step 4: Add format scripts to `package.json`**

In the `"scripts"` block add:
```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [ ] **Step 5: Verify Prettier runs**

Run: `npx prettier --check . || true`
Expected: command executes (it may list unformatted files — that is fine; we are not formatting in Stage 0).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .prettierrc .prettierignore
git commit -m "chore: add react-query, zod, rhf, prettier deps + config (Stage 0)"
```

---

### Task 2: Flip `@`→`src`, relocate `lib/`+`components/` to `src/legacy/`, codemod imports

**Files:**
- Modify: `tsconfig.json` (paths)
- Move: `lib/` → `src/legacy/lib/`, `components/` → `src/legacy/components/`
- Modify: every `*.ts`/`*.tsx` under `app/`, `src/`, `tests/` that imports `@/lib`, `@/components`, or `@/drizzle`

> Context: `vitest.config.ts` uses `vite-tsconfig-paths`, so it reads `tsconfig.json` paths automatically — no Vitest change needed. `proxy.ts`, `drizzle.config.ts`, `next.config.ts`, and `scripts/*.mts` do NOT use the `@` alias (verified), so they are out of scope.

- [ ] **Step 1: Relocate directories**

Run:
```bash
mkdir -p src/legacy
git mv lib src/legacy/lib
git mv components src/legacy/components
```

- [ ] **Step 1b: Fix the relocated font's relative path (keeps the build green)**

`next/font/local`'s `src` is resolved relative to the file. After the move, `src/legacy/lib/fonts/index.ts` still says `../../public/...`, which now wrongly points at `src/legacy/public`. The root layout imports this font, so `npm run build` (Step 6) would fail with module-not-found. Fix the path to reach the repo root from the new depth (`src/legacy/lib/fonts/` → root is four levels up):

In `src/legacy/lib/fonts/index.ts`, set:
```ts
  src: "../../../../public/fonts/PretendardVariable.woff2",
```
(Task 7 moves this file to `src/shared/config/fonts.ts` and resets the path to `../../../public/...`.)

- [ ] **Step 2: Update `tsconfig.json` paths**

Replace the `paths` block:
```json
"paths": {
  "@/*": ["./src/*"],
  "@drizzle/*": ["./drizzle/*"]
}
```

- [ ] **Step 3: Codemod all `@` imports (uniform, non-breaking)**

Run:
```bash
grep -rlE "@/(lib|components|drizzle)/" app src tests --include="*.ts" --include="*.tsx" \
  | xargs perl -pi -e 's{\@/lib/}{\@/legacy/lib/}g; s{\@/components/}{\@/legacy/components/}g; s{\@/drizzle/}{\@drizzle/}g;'
```
This rewrites `@/lib/*`→`@/legacy/lib/*`, `@/components/*`→`@/legacy/components/*`, `@/drizzle/*`→`@drizzle/*` everywhere, so all imports resolve against the new layout immediately.

- [ ] **Step 4: Verify no stale specifiers remain**

Run:
```bash
grep -rnE "@/(lib|components)/|@/drizzle/" app src tests --include="*.ts" --include="*.tsx"
```
Expected: **no output** (every old specifier was rewritten).

- [ ] **Step 5: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: PASS (exit 0). If any "Cannot find module" appears, an import was missed — fix it and re-run.

- [ ] **Step 6: Verify lint, tests, build**

Run: `npm run lint && npm test && npm run build`
Expected: all PASS. The 15 existing test files import via `@/...` and now resolve through `@/legacy/...`; the app builds unchanged.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: flip @ alias to src, relocate lib/components to src/legacy (Stage 0)"
```

---

### Task 3: `shared/api/http.ts` — client fetch wrapper (TDD)

**Files:**
- Create: `src/shared/api/http.ts`
- Test: `tests/shared/api/http.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpError } from "@/shared/api/http";

afterEach(() => vi.restoreAllMocks());

describe("http", () => {
  it("returns parsed JSON on ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: 1 }), { status: 200 })));
    await expect(http<{ id: number }>("/x")).resolves.toEqual({ id: 1 });
  });

  it("returns undefined on 204", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await expect(http("/x")).resolves.toBeUndefined();
  });

  it("throws HttpError with status and server code on error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 })));
    await expect(http("/x")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    await expect(http("/x")).rejects.toBeInstanceOf(HttpError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/shared/api/http.test.ts`
Expected: FAIL with "Cannot find module '@/shared/api/http'".

- [ ] **Step 3: Write minimal implementation**

```ts
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "HttpError";
  }
}

export async function http<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  if (!res.ok) {
    let code = "REQUEST_FAILED";
    try {
      const body = await res.json();
      if (body?.error) code = String(body.error);
    } catch {
      // non-JSON error body — keep the default code
    }
    throw new HttpError(res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/shared/api/http.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/http.ts tests/shared/api/http.test.ts
git commit -m "feat: shared/api http fetch wrapper with HttpError (Stage 0)"
```

---

### Task 4: `shared/api/to-error-response.ts` — server error→Response mapping (TDD)

**Files:**
- Create: `src/shared/api/to-error-response.ts`
- Test: `tests/shared/api/to-error-response.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toErrorResponse } from "@/shared/api/to-error-response";

describe("toErrorResponse", () => {
  it("maps FORBIDDEN to 403", async () => {
    const res = toErrorResponse(new Error("FORBIDDEN"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "FORBIDDEN" });
  });

  it("maps LOGIN_REQUIRED to 401", () => {
    expect(toErrorResponse(new Error("LOGIN_REQUIRED")).status).toBe(401);
  });

  it("maps ZodError to 400 VALIDATION_ERROR", async () => {
    const err = z.object({ title: z.string() }).safeParse({}).error!;
    const res = toErrorResponse(err);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION_ERROR");
  });

  it("maps unknown error to 500", () => {
    expect(toErrorResponse("boom").status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/shared/api/to-error-response.test.ts`
Expected: FAIL with "Cannot find module '@/shared/api/to-error-response'".

- [ ] **Step 3: Write minimal implementation**

```ts
import { ZodError } from "zod";

const STATUS_BY_CODE: Record<string, number> = {
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  LOGIN_REQUIRED: 401,
  NOT_FOUND: 404,
};

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json({ error: "VALIDATION_ERROR", issues: error.issues }, { status: 400 });
  }
  if (error instanceof Error && STATUS_BY_CODE[error.message]) {
    return Response.json({ error: error.message }, { status: STATUS_BY_CODE[error.message] });
  }
  return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/shared/api/to-error-response.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/to-error-response.ts tests/shared/api/to-error-response.test.ts
git commit -m "feat: shared/api error-to-Response mapping (Stage 0)"
```

---

### Task 5: `shared/api/query-client.ts` + `shared/api/same-origin.ts` (TDD)

**Files:**
- Create: `src/shared/api/query-client.ts`
- Create: `src/shared/api/same-origin.ts`
- Test: `tests/shared/api/query-client.test.ts`
- Test: `tests/shared/api/same-origin.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/shared/api/query-client.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeQueryClient } from "@/shared/api/query-client";
import { HttpError } from "@/shared/api/http";

describe("makeQueryClient", () => {
  it("sets a 30s default staleTime", () => {
    const qc = makeQueryClient();
    expect(qc.getDefaultOptions().queries?.staleTime).toBe(30_000);
  });

  it("does not retry 4xx but retries other errors up to 2x", () => {
    const retry = makeQueryClient().getDefaultOptions().queries?.retry as (n: number, e: unknown) => boolean;
    expect(retry(0, new HttpError(404, "NOT_FOUND"))).toBe(false);
    expect(retry(0, new HttpError(500, "INTERNAL_ERROR"))).toBe(true);
    expect(retry(2, new HttpError(500, "INTERNAL_ERROR"))).toBe(false);
  });
});
```

`tests/shared/api/same-origin.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isSameOrigin } from "@/shared/api/same-origin";

describe("isSameOrigin", () => {
  it("returns true when origin host matches host header", () => {
    expect(isSameOrigin("https://app.example.com", "app.example.com")).toBe(true);
  });
  it("returns false on host mismatch", () => {
    expect(isSameOrigin("https://evil.com", "app.example.com")).toBe(false);
  });
  it("returns false when origin or host is missing", () => {
    expect(isSameOrigin(null, "app.example.com")).toBe(false);
    expect(isSameOrigin("https://app.example.com", null)).toBe(false);
  });
  it("returns false on malformed origin", () => {
    expect(isSameOrigin("not-a-url", "app.example.com")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/shared/api/query-client.test.ts tests/shared/api/same-origin.test.ts`
Expected: FAIL with "Cannot find module" for both.

- [ ] **Step 3: Write minimal implementations**

`src/shared/api/query-client.ts`:
```ts
import { QueryClient } from "@tanstack/react-query";
import { HttpError } from "./http";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount: number, error: unknown) => {
          if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}
```

`src/shared/api/same-origin.ts`:
```ts
export function isSameOrigin(originHeader: string | null, host: string | null): boolean {
  if (!originHeader || !host) return false;
  try {
    return new URL(originHeader).host === host;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/shared/api/query-client.test.ts tests/shared/api/same-origin.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/query-client.ts src/shared/api/same-origin.ts tests/shared/api/query-client.test.ts tests/shared/api/same-origin.test.ts
git commit -m "feat: shared/api query-client defaults + same-origin predicate (Stage 0)"
```

---

### Task 6: Promote shared modules out of `src/legacy/`

**Files (move + codemod):**
- `src/legacy/components/ui/*` → `src/shared/ui/*`
- `src/legacy/lib/utils.ts` → `src/shared/lib/utils.ts`
- `src/legacy/lib/auth/roles.ts` → `src/shared/auth/roles.ts`
- `src/legacy/lib/auth/session.ts` → `src/shared/auth/guards.server.ts` (add `import "server-only"`)
- `src/legacy/lib/supabase/` → `src/shared/supabase/`
- `src/legacy/lib/db/` → `src/shared/db/`
- `src/legacy/lib/realtime/` → `src/shared/realtime/` (pure modules: channel/identity/coords — the realtime **provider** is NOT moved in Stage 0; see note)
- `src/legacy/lib/proposals/{public-id,variant-slug,constants,access}.ts` → `src/shared/lib/proposals/`
- `src/legacy/lib/proposals/storage.ts` → `src/shared/storage.ts` (add `import "server-only"`)

> Not moved in Stage 0 (stay in legacy until their slice migrates): `proposals/upload-client.ts` (client, → feature in Stage 1/2). Everything under `legacy/lib/{pins,meeting,preview,access}` and `legacy/components/{admin,proposals,preview,realtime}` stays until later stages. `fonts` moves in Task 7 (tied to the layout).
>
> **Realtime provider deliberately NOT promoted in Stage 0** (audit fix): `components/realtime/realtime-provider.tsx` is imported by its four siblings (`canvas-cursors`, `chat-panel`, `presence-bar`, `realtime-shell`) via a **relative** `./realtime-provider` path that the alias-only codemod would not rewrite, and it itself imports `pins/types` + `meeting/types` (which stay in legacy). Moving it now would break the build and create a shared→legacy inversion. It is promoted to `shared/realtime` in **Stage 5** with the rest of the realtime slice. (Supersedes spec §7's 0b placement of the provider.)

- [ ] **Step 1: Move the directories/files**

Run:
```bash
mkdir -p src/shared/ui src/shared/lib/proposals src/shared/auth
# NOTE: do NOT pre-create src/shared/{supabase,db,realtime} — those are whole-directory
# renames below and must not exist beforehand, or git mv would nest them.
git mv src/legacy/components/ui/* src/shared/ui/
git mv src/legacy/lib/utils.ts src/shared/lib/utils.ts
git mv src/legacy/lib/auth/roles.ts src/shared/auth/roles.ts
git mv src/legacy/lib/auth/session.ts src/shared/auth/guards.server.ts
git mv src/legacy/lib/supabase src/shared/supabase
git mv src/legacy/lib/db src/shared/db
git mv src/legacy/lib/realtime src/shared/realtime
git mv src/legacy/lib/proposals/public-id.ts src/shared/lib/proposals/public-id.ts
git mv src/legacy/lib/proposals/variant-slug.ts src/shared/lib/proposals/variant-slug.ts
git mv src/legacy/lib/proposals/constants.ts src/shared/lib/proposals/constants.ts
git mv src/legacy/lib/proposals/access.ts src/shared/lib/proposals/access.ts
git mv src/legacy/lib/proposals/storage.ts src/shared/storage.ts
```

- [ ] **Step 2: Add `server-only` markers**

Prepend `import "server-only";` as the first line of `src/shared/auth/guards.server.ts` and `src/shared/storage.ts`.

- [ ] **Step 3: Codemod importers (app/, src/, tests/)**

Run:
```bash
grep -rlE "@/legacy/(lib|components)/" app src tests --include="*.ts" --include="*.tsx" \
  | xargs perl -pi -e '
    s{\@/legacy/components/ui/}{\@/shared/ui/}g;
    s{\@/legacy/lib/utils}{\@/shared/lib/utils}g;
    s{\@/legacy/lib/auth/roles}{\@/shared/auth/roles}g;
    s{\@/legacy/lib/auth/session}{\@/shared/auth/guards.server}g;
    s{\@/legacy/lib/supabase/}{\@/shared/supabase/}g;
    s{\@/legacy/lib/db}{\@/shared/db}g;
    s{\@/legacy/lib/realtime/}{\@/shared/realtime/}g;
    s{\@/legacy/lib/proposals/public-id}{\@/shared/lib/proposals/public-id}g;
    s{\@/legacy/lib/proposals/variant-slug}{\@/shared/lib/proposals/variant-slug}g;
    s{\@/legacy/lib/proposals/constants}{\@/shared/lib/proposals/constants}g;
    s{\@/legacy/lib/proposals/access}{\@/shared/lib/proposals/access}g;
    s{\@/legacy/lib/proposals/storage}{\@/shared/storage}g;
  '
```

- [ ] **Step 4: Update `components.json` aliases**

Set the `aliases` block to:
```json
"aliases": {
  "components": "@/shared",
  "utils": "@/shared/lib/utils",
  "ui": "@/shared/ui",
  "lib": "@/shared/lib",
  "hooks": "@/shared/hooks"
}
```

- [ ] **Step 5: Verify no stale legacy specifiers for promoted modules**

Run:
```bash
grep -rnE "@/legacy/(components/ui|lib/utils|lib/auth|lib/supabase|lib/db|lib/realtime|lib/proposals/(public-id|variant-slug|constants|access|storage))" app src tests --include="*.ts" --include="*.tsx"
```
Expected: **no output**.

- [ ] **Step 6: Verify green gate**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all PASS. (Existing proposals/auth tests now import from `@/shared/...` and still pass.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: promote ui/utils/auth/supabase/db/realtime/storage to src/shared (Stage 0)"
```

---

### Task 7: Providers + root layout wiring + globals/fonts move

**Files:**
- Create: `src/app/providers/query-provider.tsx`
- Move: `src/legacy/lib/fonts/index.ts` → `src/shared/config/fonts.ts` (fix relative font path)
- Move: `app/globals.css` → `src/app/styles/globals.css`
- Modify: `app/layout.tsx`
- Modify: `components.json` (`css` path)

> Deviation from spec: the spec lists a `theme-provider`, but the app currently wires NO theme provider (`next-themes` is used only inside `sonner.tsx`, which works without one). Adding a provider would change theming behavior, so we omit it (YAGNI) and revisit if dark-mode is wired later.

- [ ] **Step 1: Create the QueryProvider**

`src/app/providers/query-provider.tsx`:
```tsx
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { makeQueryClient } from "@/shared/api/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={client}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Move fonts and fix the relative path**

Run:
```bash
mkdir -p src/shared/config
git mv src/legacy/lib/fonts/index.ts src/shared/config/fonts.ts
```
Then edit `src/shared/config/fonts.ts` — change the `src` to account for the deeper location (`src/shared/config` → repo root is three levels up):
```ts
import localFont from "next/font/local";

export const pretendard = localFont({
  src: "../../../public/fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-pretendard",
});
```

- [ ] **Step 3: Move globals.css**

Run:
```bash
mkdir -p src/app/styles
git mv app/globals.css src/app/styles/globals.css
```

- [ ] **Step 4: Rewrite `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { pretendard } from "@/shared/config/fonts";
import { QueryProvider } from "@/app/providers/query-provider";
import "@/app/styles/globals.css";

export const metadata: Metadata = { title: "uxis live design" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className={`${pretendard.className} antialiased`}>
        <NuqsAdapter>
          <QueryProvider>{children}</QueryProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Update `components.json` css path**

Set `"tailwind"."css"` to `"src/app/styles/globals.css"`.

- [ ] **Step 6: Verify build + dev smoke**

Run: `npm run build`
Expected: PASS (CSS resolves via `@/app/styles/globals.css`, fonts resolve, layout compiles).

> Tailwind v4 note (verified): `@tailwindcss/postcss` scans for class names from its `base`, which defaults to `process.cwd()` (the project root) — NOT the location of `globals.css`. `postcss.config.mjs` passes no `base`, `globals.css` uses a bare `@import "tailwindcss"` with no `@source` directives, and `.gitignore` does not exclude `src/`. So moving `globals.css` and all sources under `src/` keeps them inside the scan root — class detection still works and **no `@source` globs are needed**. Do not "fix" this; styles will be correct.

Then run `npm run dev`, open the app, and confirm: the dashboard renders with correct fonts/styles, no console errors, and the React Query Devtools toggle appears. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: QueryProvider in root layout, move globals/fonts to src (Stage 0)"
```

---

### Task 8: Stage 0 verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full green gate**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 2: Assert `src/app` holds no route files**

Run:
```bash
find src/app -type f \( -name "page.tsx" -o -name "layout.tsx" -o -name "route.ts" -o -name "loading.tsx" \)
```
Expected: **no output** (Next ignores `src/app` because root `app/` exists; it must contain only providers/styles).

- [ ] **Step 3: Assert no pre-migration `@/lib` / `@/components` / `@/drizzle` specifiers remain**

Run:
```bash
grep -rnE "@/(lib|components)/|@/drizzle/" app src tests --include="*.ts" --include="*.tsx"
```
Expected: **no output** (everything resolves via `@/legacy/*`, `@/shared/*`, or `@drizzle/*`).

- [ ] **Step 4: Confirm no runtime behavior changed**

Manual check: the app behaves exactly as before Stage 0 (same pages, same auth redirects). Stage 0 added tooling/structure only.

- [ ] **Step 5: Final commit (if any fixups were needed)**

```bash
git add -A
git commit -m "chore: Stage 0 verification fixups" || echo "nothing to commit"
```

---

## Self-Review (completed by author)

- **Spec coverage (Stage 0):** deps + Prettier (Task 1), `@→src` + `@drizzle` + legacy relocation (Task 2), shared/api infra incl. CSRF predicate (Tasks 3–5), shared promotions + components.json + server-only (Task 6), QueryProvider + NuqsAdapter preservation + globals/fonts (Task 7), `src/app` no-route + no-stale-import gates (Task 8). The CSRF predicate is built here but **wired into `proxy.ts`/routes in Stage 1** (first fetch-mutation slice) — noted so it is not orphaned silently. `theme-provider` consciously omitted (YAGNI, documented).
- **Placeholder scan:** none — every code/codemod/command step is concrete.
- **Type consistency:** `HttpError` (Task 3) is consumed by `query-client` (Task 5) and tests; `makeQueryClient` (Task 5) consumed by `QueryProvider` (Task 7); `toErrorResponse`/`isSameOrigin` are self-contained. Names match across tasks.

**Adversarial audit (3 lenses: codemod / Next16+Tailwind / TDD) applied:**
- Fixed 2 blockers: (a) the relocated font path broke Task 2's own build gate → font path corrected in Task 2 Step 1b; (b) promoting `realtime-provider` would break 4 siblings' relative imports and invert FSD layering → provider promotion deferred to Stage 5.
- `server-only` is not a real Next package (compiler-aliased only) → installed as a devDependency in Task 1 so `tsc`/Vitest resolve it.
- Confirmed safe (documented inline): Tailwind v4 source scan is rooted at `process.cwd()`, so moving sources under `src/` needs no `@source` change; the `@/app/styles/globals.css` CSS alias import resolves; `next/font/local` path depth verified.

## Next stages (written just-in-time)

After Stage 0 lands and is verified, write the **Stage 1 (proposals)** plan: `entities/proposal` (query factory + client fetchers + guarded `*.server.ts`), `app/api/proposals` thin wrapper, `proposals-list`/`proposal-new` pages client-side via `useQuery`, `features/create-proposal` (RHF+Zod), `(auth)` migration, and the first CSRF wiring in `proxy.ts`. Each subsequent stage (2–6) gets its own plan in turn.
