# Phase 1a — Foundation & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js + Supabase + Drizzle foundation with the design system, email auth (signup → pending → admin approval), and admin user management.

**Architecture:** BFF — the browser never queries Supabase for data; all data access goes through Next.js Route Handlers/Server Actions using **Drizzle** over the Supabase transaction pooler. Supabase Auth (via `@supabase/ssr`) manages sessions only. Authorization is enforced in app code (primary); RLS with `FORCE ROW LEVEL SECURITY` + deny-by-default is a hard backstop. See `docs/superpowers/specs/2026-06-15-uxis-live-design-design.md` and `docs/design-system.md`.

**Tech Stack:** Next.js (App Router, TypeScript), Tailwind + shadcn/ui, Pretendard, Drizzle ORM (`drizzle-orm` + `drizzle-kit`, `postgres-js`), Supabase (Postgres/Auth), Vitest, npm.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `package.json`, `next.config.ts`, `tsconfig.json` | scaffold config |
| `.env.local` (git-ignored) / `.env.example` (committed) | secrets / placeholders |
| `drizzle.config.ts` | drizzle-kit config (schema path, DB url) |
| `drizzle/schema.ts` | all table definitions (Phase 1a: `profiles`) |
| `drizzle/migrations/*` | generated SQL + appended RLS/trigger SQL |
| `lib/db/index.ts` | Drizzle client (postgres-js, `prepare:false`) |
| `lib/supabase/server.ts` | `@supabase/ssr` server client (cookies) |
| `lib/supabase/client.ts` | `@supabase/ssr` browser client (auth only) |
| `lib/auth/session.ts` | `getSessionUser`, `getProfile`, role guards (pure-ish, tested) |
| `lib/auth/roles.ts` | role constants + pure predicate helpers (unit tested) |
| `middleware.ts` | session refresh + route protection |
| `app/layout.tsx`, `app/globals.css` | root layout, Pretendard, design tokens |
| `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx` | auth screens |
| `app/(auth)/actions.ts` | signup/login/logout server actions |
| `app/pending/page.tsx` | "승인 대기" screen for pending users |
| `app/(dashboard)/layout.tsx` | authenticated shell (sidebar) |
| `app/(dashboard)/admin/users/page.tsx` | admin user list |
| `app/api/admin/users/route.ts`, `app/api/admin/users/[id]/route.ts` | admin approve/role API (BFF) |
| `components/ui/*` | shadcn primitives |
| `lib/fonts/` + `public/fonts/` | Pretendard files |
| `vitest.config.ts`, `tests/**` | test setup |

---

## Task 1: Scaffold Next.js app

**Files:**
- Create: project scaffold (`package.json`, `app/`, `tsconfig.json`, etc.)

- [ ] **Step 1: Create the Next.js app in the current directory**

The repo already exists with `docs/` and `.gitignore`. Scaffold into the current directory (`.`):

Run:
```bash
npx create-next-app@latest . --ts --eslint --app --tailwind --no-src-dir --import-alias "@/*" --use-npm
```
When prompted that the directory is not empty, choose to proceed (it keeps `docs/`, `.gitignore`, `.git/`). If it refuses, scaffold in a temp dir and move files in.

- [ ] **Step 2: Verify dev server boots**

Run:
```bash
npm run dev
```
Expected: server starts on `http://localhost:3000`, no errors. Stop it (Ctrl-C).

- [ ] **Step 3: Confirm .gitignore still excludes env + node_modules**

Run:
```bash
git check-ignore .env.local node_modules
```
Expected output:
```
.env.local
node_modules
```
If `create-next-app` overwrote `.gitignore`, re-add the lines `.env` and `.env*.local`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app (App Router, TS, Tailwind)"
```

---

## Task 2: Install & configure Vitest

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install Vitest**

Run:
```bash
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
```

- [ ] **Step 3: Add test script to `package.json`**

In `"scripts"` add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Add a smoke test `tests/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add Vitest"
```

---

## Task 3: Environment variables

**Files:**
- Create: `.env.example` (committed), `.env.local` (NOT committed)

- [ ] **Step 1: Create `.env.example` (placeholders only — committed)**

```bash
# Drizzle → Supabase transaction pooler (IPv4 shared)
DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"

# Supabase (Auth / Realtime)
NEXT_PUBLIC_SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."

# Server-only secret — NEVER expose to the client
SUPABASE_SECRET_KEY="sb_secret_..."
```

- [ ] **Step 2: Create `.env.local` with the REAL values**

Project ref is `mjplcodqaarssdwuqjzm`, region `aws-1-ap-northeast-2`. Fill the real DB password, publishable key, and secret key (provided out-of-band; do not paste into committed files):
```bash
DATABASE_URL="postgresql://postgres.mjplcodqaarssdwuqjzm:<DB_PASSWORD>@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://mjplcodqaarssdwuqjzm.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."
```

- [ ] **Step 3: Verify `.env.local` is ignored**

Run: `git status --short`
Expected: `.env.local` does NOT appear. `.env.example` appears as new.

- [ ] **Step 4: Commit (only the example)**

```bash
git add .env.example
git commit -m "chore: add env example"
```

---

## Task 4: Drizzle setup + DB connection

**Files:**
- Create: `drizzle.config.ts`, `lib/db/index.ts`, `drizzle/schema.ts`, `scripts/db-ping.ts`
- Modify: `package.json` (db scripts)

- [ ] **Step 1: Install Drizzle + driver + tsx**

Run:
```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit tsx
```

- [ ] **Step 2: Create `drizzle/schema.ts` (empty placeholder for now)**

```ts
// All table definitions live here. Tables added in Task 6.
export {};
```

- [ ] **Step 3: Create `lib/db/index.ts`**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/drizzle/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

// prepare:false is required for Supabase transaction pool mode
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
```

- [ ] **Step 4: Create `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 5: Add db scripts to `package.json`**

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:ping": "tsx --env-file=.env.local scripts/db-ping.ts"
```

- [ ] **Step 6: Create `scripts/db-ping.ts`**

```ts
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const rows = await sql`select 1 as ok`;
console.log("DB OK:", rows[0]);
await sql.end();
```

- [ ] **Step 7: Verify the DB connection**

Run: `npm run db:ping`
Expected: `DB OK: { ok: 1 }`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle client and DB connection"
```

---

## Task 5: Pretendard font + design tokens

**Files:**
- Create: `lib/fonts/index.ts`, `public/fonts/` (Pretendard woff2)
- Modify: `app/layout.tsx`, `app/globals.css`

- [ ] **Step 1: Add Pretendard variable font file**

Download `PretendardVariable.woff2` into `public/fonts/PretendardVariable.woff2` (from the Pretendard repo releases).

- [ ] **Step 2: Create `lib/fonts/index.ts`**

```ts
import localFont from "next/font/local";

export const pretendard = localFont({
  src: "../../public/fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-pretendard",
});
```

- [ ] **Step 3: Wire the font in `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { pretendard } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = { title: "uxis live design" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="font-sans antialiased bg-background text-foreground">{children}</body>
    </html>
  );
}
```

> Note: design **token** values (colors/radius) are set in Task 6 **after** `shadcn init`,
> because `shadcn init` regenerates `globals.css`. This task only wires the font.

- [ ] **Step 4: Verify the font renders**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: page renders in Pretendard (text uses the variable font). Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Pretendard font"
```

---

## Task 6: shadcn/ui init + base components

**Files:**
- Create: `components/ui/*` (button, input, label, card, table, dialog, badge, dropdown-menu, sonner)
- Modify: `components.json`

- [ ] **Step 1: Init shadcn**

Run:
```bash
npx shadcn@latest init -d
```
Accept defaults (it detects Tailwind + the CSS variables).

- [ ] **Step 2: Add the components used in Phase 1**

Run:
```bash
npx shadcn@latest add button input label card table dialog badge dropdown-menu sonner
```

- [ ] **Step 3: Set design tokens in `app/globals.css`**

`shadcn init` wrote a `:root` (and `.dark`) block. Override the `:root` values with the design-system hex (`docs/design-system.md` §1.3). Match shadcn's color format (Tailwind v4 + shadcn uses `oklch()`; if so, convert these hex to oklch, otherwise keep hex):

```
--background: #ffffff;        --foreground: #080808;
--card: #ffffff;              --card-foreground: #080808;
--popover: #ffffff;           --popover-foreground: #080808;
--primary: #080808;           --primary-foreground: #ffffff;
--secondary: #ffffff;         --secondary-foreground: #080808;
--muted: #f7f7f7;             --muted-foreground: #5a5a5a;
--accent: #f7f7f7;            --accent-foreground: #080808;
--destructive: #ee1d36;       --destructive-foreground: #ffffff;
--border: #d8d8d8;            --input: #d8d8d8;            --ring: #146ef5;
--radius: 0.5rem;
```
This project is light-only for Phase 1a — leave `.dark` as generated (not used yet).

- [ ] **Step 4: Add font-sans + brand/semantic colors to the theme**

In the Tailwind theme (Tailwind v4: the `@theme` block in `globals.css`; v3: `tailwind.config.ts` `extend`), map `--font-sans` to the Pretendard variable and add the brand accents:

```css
@theme inline {
  --font-sans: var(--font-pretendard), -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --color-accent-purple: #7a3dff;
  --color-accent-pink: #ed52cb;
  --color-accent-blue: #3b89ff;
  --color-accent-orange: #ff6b00;
  --color-accent-green: #00d722;
  --color-accent-yellow: #ffae13;
  --color-info: #146ef5;
  --color-success: #00d722;
  --color-warning: #ffae13;
  --color-error: #ee1d36;
}
```

- [ ] **Step 5: Override button radius to 4px**

In `components/ui/button.tsx`, change the base class `rounded-md` to `rounded-[4px]` (design system: buttons 4px, cards 8px).

- [ ] **Step 6: Verify build + tokens render**

Run: `npm run build`
Expected: build succeeds with no type errors.
Then `npm run dev`, open `/` — white background, near-black text, Pretendard. Stop server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add shadcn/ui base components and design tokens"
```

---

## Task 7: `profiles` table + RLS backstop + signup trigger

**Files:**
- Modify: `drizzle/schema.ts`
- Create/Modify: `drizzle/migrations/*` (append custom SQL)

- [ ] **Step 1: Define `profiles` in `drizzle/schema.ts`**

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id (FK added via SQL)
  email: text("email").notNull(),
  displayName: text("display_name"),
  role: text("role").notNull().default("pending"), // 'pending' | 'editor' | 'admin'
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: uuid("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: a new SQL file under `drizzle/migrations/` creating the `profiles` table.

- [ ] **Step 3: Append RLS + FK + trigger SQL to the generated migration file**

Open the newly generated `drizzle/migrations/<timestamp>_*.sql` and append:

```sql
-- FK to auth.users
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_auth_users_fk"
  FOREIGN KEY ("id") REFERENCES auth.users(id) ON DELETE CASCADE;

-- RLS backstop: deny-by-default for PostgREST roles (Drizzle uses the
-- privileged pooler connection and is unaffected).
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" FORCE ROW LEVEL SECURITY;
-- No policies for anon/authenticated => no access via publishable key.

-- Auto-create a pending profile when a user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'pending')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 4: Apply the migration**

Run: `npm run db:migrate`
Expected: migration applies with no error.

- [ ] **Step 5: Verify table + RLS via db-ping style check**

Create `scripts/check-profiles.ts`:
```ts
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const t = await sql`select relrowsecurity, relforcerowsecurity from pg_class where relname = 'profiles'`;
console.log("profiles RLS:", t[0]); // expect { relrowsecurity: true, relforcerowsecurity: true }
await sql.end();
```
Run: `npx tsx --env-file=.env.local scripts/check-profiles.ts`
Expected: `profiles RLS: { relrowsecurity: true, relforcerowsecurity: true }`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add profiles table, RLS backstop, signup trigger"
```

---

## Task 8: Role helpers (pure, unit tested)

**Files:**
- Create: `lib/auth/roles.ts`, `tests/auth/roles.test.ts`

- [ ] **Step 1: Write the failing test `tests/auth/roles.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { isEditor, isAdmin, canEditProposals, ROLES } from "@/lib/auth/roles";

describe("roles", () => {
  it("admin and editor can edit proposals; pending cannot", () => {
    expect(canEditProposals(ROLES.ADMIN)).toBe(true);
    expect(canEditProposals(ROLES.EDITOR)).toBe(true);
    expect(canEditProposals(ROLES.PENDING)).toBe(false);
  });
  it("isAdmin only for admin", () => {
    expect(isAdmin(ROLES.ADMIN)).toBe(true);
    expect(isAdmin(ROLES.EDITOR)).toBe(false);
  });
  it("isEditor true for editor and admin", () => {
    expect(isEditor(ROLES.EDITOR)).toBe(true);
    expect(isEditor(ROLES.ADMIN)).toBe(true);
    expect(isEditor(ROLES.PENDING)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npm test -- roles`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/auth/roles.ts`**

```ts
export const ROLES = { PENDING: "pending", EDITOR: "editor", ADMIN: "admin" } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const isAdmin = (role: Role | null | undefined): boolean => role === ROLES.ADMIN;
export const isEditor = (role: Role | null | undefined): boolean =>
  role === ROLES.EDITOR || role === ROLES.ADMIN;
// Global edit permission: any approved editor/admin may edit all proposals.
export const canEditProposals = (role: Role | null | undefined): boolean => isEditor(role);
```

- [ ] **Step 4: Run it, verify pass**

Run: `npm test -- roles`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add role predicate helpers with tests"
```

---

## Task 9: Supabase auth clients + session helpers

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/auth/session.ts`

- [ ] **Step 1: Install `@supabase/ssr`**

Run: `npm install @supabase/supabase-js @supabase/ssr`

- [ ] **Step 2: Create `lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component — safe to ignore (middleware refreshes)
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Create `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";

export const createSupabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
```

- [ ] **Step 4: Create `lib/auth/session.ts`**

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, type Profile } from "@/drizzle/schema";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isEditor, isAdmin } from "@/lib/auth/roles";

export async function getSessionUser() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user; // null if not signed in
}

export async function getProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const rows = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  return rows[0] ?? null;
}

export async function requireEditor(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !isEditor(profile.role as never)) throw new Error("FORBIDDEN");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !isAdmin(profile.role as never)) throw new Error("FORBIDDEN");
  return profile;
}
```

- [ ] **Step 5: Verify type-check**

Run: `npm run build` (or `npx tsc --noEmit`)
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Supabase auth clients and session/guard helpers"
```

---

## Task 10: Middleware — session refresh + route protection

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create `middleware.ts`**

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Protect the dashboard: unauthenticated -> /login
  if (path.startsWith("/dashboard") || path.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
```

- [ ] **Step 2: Verify the redirect**

Run: `npm run dev`, visit `http://localhost:3000/admin/users` while logged out.
Expected: redirected to `/login`. Stop server.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add auth middleware with route protection"
```

---

## Task 11: Signup / login / logout

**Files:**
- Create: `app/(auth)/actions.ts`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create `app/(auth)/actions.ts`**

```ts
"use server";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  redirect("/pending");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Create `app/(auth)/signup/page.tsx`**

```tsx
import { signup } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight">회원가입</h1>
        <p className="mt-2 text-sm text-muted-foreground">가입 후 관리자 승인이 필요합니다.</p>
        <form action={signup} className="mt-6 space-y-4">
          <div className="space-y-2"><Label htmlFor="email">이메일</Label><Input id="email" name="email" type="email" required /></div>
          <div className="space-y-2"><Label htmlFor="password">비밀번호</Label><Input id="password" name="password" type="password" required minLength={8} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">가입하기</Button>
        </form>
        <a href="/login" className="mt-4 block text-sm underline">이미 계정이 있으신가요? 로그인</a>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/(auth)/login/page.tsx`**

```tsx
import { login } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        <form action={login} className="mt-6 space-y-4">
          <div className="space-y-2"><Label htmlFor="email">이메일</Label><Input id="email" name="email" type="email" required /></div>
          <div className="space-y-2"><Label htmlFor="password">비밀번호</Label><Input id="password" name="password" type="password" required /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">로그인</Button>
        </form>
        <a href="/signup" className="mt-4 block text-sm underline">계정이 없으신가요? 가입</a>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Manual verification of signup → profile row**

Run `npm run dev`. Sign up with a test email. Then check the profile was created:
```ts
// scripts/check-signup.ts
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const rows = await sql`select email, role from profiles order by created_at desc limit 1`;
console.log(rows[0]); // expect { email: <test>, role: 'pending' }
await sql.end();
```
Run: `npx tsx --env-file=.env.local scripts/check-signup.ts`
Expected: the new email with `role: 'pending'`.

> Note: if Supabase email confirmation is ON, the user must confirm before login works. For dev, you may disable "Confirm email" in Supabase Auth settings, or confirm via the dashboard.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add signup, login, logout"
```

---

## Task 12: Pending gate + dashboard shell

**Files:**
- Create: `app/pending/page.tsx`, `app/(dashboard)/layout.tsx`, `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Create `app/pending/page.tsx`**

```tsx
import { logout } from "../(auth)/actions";
import { Button } from "@/components/ui/button";

export default function PendingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
      <h1 className="text-2xl font-semibold tracking-tight">승인 대기 중</h1>
      <p className="text-sm text-muted-foreground">관리자 승인 후 시안을 관리할 수 있습니다.</p>
      <form action={logout}><Button variant="outline">로그아웃</Button></form>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(dashboard)/layout.tsx` with the pending gate**

```tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/session";
import { isEditor, isAdmin } from "@/lib/auth/roles";
import { logout } from "../(auth)/actions";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!isEditor(profile.role as never)) redirect("/pending");

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r border-border p-4">
        <div className="mb-6 text-sm font-medium tracking-tight">uxis live design</div>
        <nav className="space-y-1 text-sm">
          <a href="/dashboard/proposals" className="block rounded-[4px] px-3 py-2 hover:bg-muted">시안</a>
          {isAdmin(profile.role as never) && (
            <a href="/admin/users" className="block rounded-[4px] px-3 py-2 hover:bg-muted">사용자 관리</a>
          )}
        </nav>
        <form action={logout} className="mt-6"><Button variant="outline" className="w-full">로그아웃</Button></form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create a placeholder `app/(dashboard)/dashboard/page.tsx`**

```tsx
export default function DashboardHome() {
  return <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>;
}
```

- [ ] **Step 4: Verify the gate**

Run `npm run dev`. Log in as the pending test user → expect redirect to `/pending`. Promote them in the DB to confirm dashboard access:
```bash
npx tsx --env-file=.env.local -e "import('postgres').then(async m=>{const s=m.default(process.env.DATABASE_URL,{prepare:false});await s\`update profiles set role='admin' where email=${'<your-test-email>'}\`;await s.end();console.log('promoted')})"
```
Reload → expect dashboard + "사용자 관리" link visible.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add pending gate and dashboard shell"
```

---

## Task 13: Admin user management (BFF API + UI)

**Files:**
- Create: `app/api/admin/users/route.ts`, `app/api/admin/users/[id]/route.ts`, `app/(dashboard)/admin/users/page.tsx`, `components/admin/user-row-actions.tsx`

- [ ] **Step 1: List API — `app/api/admin/users/route.ts`**

```ts
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/drizzle/schema";
import { requireAdmin } from "@/lib/auth/session";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const rows = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
  return NextResponse.json(rows);
}
```

- [ ] **Step 2: Update API — `app/api/admin/users/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/drizzle/schema";
import { requireAdmin } from "@/lib/auth/session";
import { ROLES } from "@/lib/auth/roles";

const ALLOWED = new Set<string>([ROLES.PENDING, ROLES.EDITOR, ROLES.ADMIN]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const role = String(body.role);
  if (!ALLOWED.has(role)) return NextResponse.json({ error: "INVALID_ROLE" }, { status: 400 });

  await db.update(profiles)
    .set({
      role,
      approvedAt: role === ROLES.PENDING ? null : new Date(),
      approvedBy: role === ROLES.PENDING ? null : admin.id,
    })
    .where(eq(profiles.id, id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Admin page — `app/(dashboard)/admin/users/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/drizzle/schema";
import { getProfile } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserRowActions } from "@/components/admin/user-row-actions";

export default async function AdminUsersPage() {
  const profile = await getProfile();
  if (!profile || !isAdmin(profile.role as never)) redirect("/dashboard");

  const rows = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">사용자 관리</h1>
      <Table className="mt-6">
        <TableHeader>
          <TableRow><TableHead>이메일</TableHead><TableHead>역할</TableHead><TableHead className="text-right">작업</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.email}</TableCell>
              <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
              <TableCell className="text-right"><UserRowActions id={u.id} role={u.role} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 4: Row actions (client) — `components/admin/user-row-actions.tsx`**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function UserRowActions({ id, role }: { id: string; role: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const setRole = (next: string) =>
    start(async () => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (res.ok) router.refresh();
    });

  return (
    <div className="flex justify-end gap-2">
      {role === "pending" && <Button size="sm" disabled={pending} onClick={() => setRole("editor")}>승인(편집자)</Button>}
      {role !== "admin" && <Button size="sm" variant="outline" disabled={pending} onClick={() => setRole("admin")}>관리자로</Button>}
      {role !== "pending" && <Button size="sm" variant="outline" disabled={pending} onClick={() => setRole("pending")}>권한 회수</Button>}
    </div>
  );
}
```

- [ ] **Step 5: Verify end-to-end**

Run `npm run dev` as the admin user. Visit `/admin/users`. Sign up a second test account in another browser. Back in admin, click "승인(편집자)" → the row's role becomes `editor` after refresh. Confirm the second account can now reach `/dashboard` (not `/pending`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add admin user management (approve, role change)"
```

---

## Task 14: Redirect root + finalize

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Redirect `/` based on session — `app/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/session";
import { isEditor } from "@/lib/auth/roles";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(isEditor(profile.role as never) ? "/dashboard" : "/pending");
}
```

- [ ] **Step 2: Full check**

Run: `npm run build` then `npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: root redirect by session/role"
```

---

## Done criteria (Phase 1a)

- A visitor can sign up; a `pending` profile row is auto-created.
- Pending users see "승인 대기"; they cannot reach the dashboard.
- An admin (bootstrapped manually in Supabase) can approve users to `editor`/`admin` and revoke.
- Approved editors land on `/dashboard`.
- No browser→Supabase data calls (auth session only); all data via Drizzle in Route Handlers/Server Actions/Server Components; `profiles` has RLS `FORCE` with no anon/authenticated policies.
- Design tokens + Pretendard + shadcn primitives in place.

**Next plan:** Phase 1b — Proposals & Viewer (proposal CRUD, `public_id`, image upload to private bucket, versions/history, visibility/password, public viewer with signed URLs + unlock gate).
