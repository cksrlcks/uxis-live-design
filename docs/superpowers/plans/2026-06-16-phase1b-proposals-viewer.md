# Phase 1b — Proposals & Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Before writing code:** this repo runs **Next.js 16** (`next@16.2.9`) with breaking changes vs. older docs. Read the relevant guide under `node_modules/next/dist/docs/01-app/` (Route Handlers, Server Actions, dynamic `params`/`searchParams` as Promises, `cookies()` async) before each task. Follow the patterns already in the repo (`app/api/admin/users/[id]/route.ts`, `app/(auth)/actions.ts`).

**Goal:** Build proposal CRUD with private-bucket image upload (signed URLs), version history with non-destructive restore, public/private/password visibility, and a minimal public viewer at `/p/[publicId]`.

**Architecture:** BFF — browser never queries Supabase for data. All CRUD goes through Next.js Route Handlers using Drizzle over the Supabase transaction pooler. Images upload via short-lived signed upload URLs (browser → Storage direct PUT, token minted server-side after auth) and read via short-lived signed read URLs. New tables get RLS `FORCE` with no anon/authenticated policies (deny-by-default backstop). Spec: `docs/superpowers/specs/2026-06-16-phase1b-proposals-viewer-design.md`.

**Tech Stack:** Next.js 16 (App Router, TS), Drizzle (`postgres-js`), `@supabase/supabase-js` (service client for Storage), `node:crypto` (scrypt password hash + HMAC unlock cookie + random public_id), shadcn/ui, Vitest.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `drizzle/schema.ts` (modify) | add `proposals`, `proposal_versions`, `proposal_pages` |
| `drizzle/migrations/*` (generate + append) | create tables + FK/RLS/CHECK SQL |
| `.env.example` / `.env.local` (modify) | add `ACCESS_TOKEN_SECRET` |
| `lib/supabase/service.ts` (create) | service-role Supabase client (Storage only) |
| `lib/proposals/constants.ts` (create) | bucket name, allowed types, `extForContentType`, `pagePath` (pure, client-safe) |
| `lib/proposals/storage.ts` (create) | signed upload/read URL + remove (server) |
| `lib/proposals/public-id.ts` (create) | random URL code generator (pure) |
| `lib/access/password.ts` (create) | scrypt hash/verify (pure) |
| `lib/access/cookie.ts` (create) | HMAC unlock token sign/verify (pure) |
| `lib/proposals/access.ts` (create) | access decision: allow / need-password / forbidden (pure) |
| `lib/proposals/upload-client.ts` (create) | browser measure + uploadToSignedUrl + confirm payload |
| `app/api/proposals/route.ts` (create) | GET list, POST create + upload URLs |
| `app/api/proposals/[id]/route.ts` (create) | GET detail, PATCH settings, DELETE |
| `app/api/proposals/[id]/versions/route.ts` (create) | POST new version + upload URLs |
| `app/api/proposals/[id]/versions/[vid]/pages/route.ts` (create) | POST confirm uploaded pages |
| `app/api/proposals/[id]/restore/route.ts` (create) | POST restore version (new copy) |
| `app/(dashboard)/dashboard/proposals/page.tsx` (create) | list |
| `app/(dashboard)/dashboard/proposals/new/page.tsx` (create) | create form |
| `app/(dashboard)/dashboard/proposals/[id]/page.tsx` (create) | detail: preview, versions, settings |
| `app/p/[publicId]/page.tsx` (create) | public viewer (minimal render) + password gate |
| `app/p/[publicId]/actions.ts` (create) | unlock server action |
| `components/proposals/*` (create) | create form, add-version form, settings, version actions |
| `tests/proposals/*`, `tests/access/*` (create) | unit tests for pure modules |
| `scripts/setup-bucket.mts`, `scripts/check-proposals.mts` (create) | bucket creation + RLS verification |

---

## Task 1: Schema — proposals / versions / pages + migration

**Files:**
- Modify: `drizzle/schema.ts`
- Create/Modify: `drizzle/migrations/<generated>.sql`
- Create: `scripts/check-proposals.mts`

- [ ] **Step 1: Append the three tables to `drizzle/schema.ts`**

Add to the existing imports line so it reads:
```ts
import { pgTable, uuid, text, timestamp, integer, unique, check } from "drizzle-orm/pg-core";
```
Then append below the `profiles` block:
```ts
export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicId: text("public_id").notNull().unique(),
  title: text("title").notNull(),
  ownerId: uuid("owner_id").notNull(),
  visibility: text("visibility").notNull().default("private"), // 'private' | 'public'
  accessPasswordHash: text("access_password_hash"), // 'salt:hash' (scrypt), public+password only
  currentVersionId: uuid("current_version_id"), // FK added via SQL (circular)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("proposals_visibility_check", sql`${t.visibility} in ('private', 'public')`),
]);

export const proposalVersions = pgTable("proposal_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull(),
  versionNo: integer("version_no").notNull(),
  note: text("note"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("proposal_versions_proposal_version_unique").on(t.proposalId, t.versionNo),
]);

export const proposalPages = pgTable("proposal_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionId: uuid("version_id").notNull(),
  pageOrder: integer("page_order").notNull(),
  storagePath: text("storage_path").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
}, (t) => [
  unique("proposal_pages_version_order_unique").on(t.versionId, t.pageOrder),
]);

export type Proposal = typeof proposals.$inferSelect;
export type ProposalVersion = typeof proposalVersions.$inferSelect;
export type ProposalPage = typeof proposalPages.$inferSelect;
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: a new `drizzle/migrations/<timestamp>_*.sql` with `CREATE TABLE` for the three tables (plus the unique + check constraints).

- [ ] **Step 3: Append FK + RLS SQL to the generated file**

Open the newly generated migration and append (FKs are added after both tables exist to avoid the circular `proposals.current_version_id ↔ proposal_versions.proposal_id` ordering problem):
```sql
--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_owner_id_profiles_fk" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_proposals_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_created_by_profiles_fk" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "proposal_pages" ADD CONSTRAINT "proposal_pages_version_id_versions_fk" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_current_version_id_versions_fk" FOREIGN KEY ("current_version_id") REFERENCES "proposal_versions"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "proposals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_pages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_pages" FORCE ROW LEVEL SECURITY;
```

- [ ] **Step 4: Apply the migration**

Run: `npm run db:migrate`
Expected: applies with no error.

- [ ] **Step 5: Add `scripts/check-proposals.mts` and verify RLS**

```ts
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
for (const rel of ["proposals", "proposal_versions", "proposal_pages"]) {
  const r = await sql`select relrowsecurity, relforcerowsecurity from pg_class where relname = ${rel}`;
  console.log(rel, "RLS:", r[0]); // expect { relrowsecurity: true, relforcerowsecurity: true }
}
await sql.end();
```
Run: `npx tsx --env-file=.env.local scripts/check-proposals.mts`
Expected: all three print `{ relrowsecurity: true, relforcerowsecurity: true }`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add proposals/versions/pages tables + RLS backstop"
```

---

## Task 2: Add `ACCESS_TOKEN_SECRET` env var

**Files:**
- Modify: `.env.example` (committed), `.env.local` (NOT committed)

- [ ] **Step 1: Append placeholder to `.env.example`**

```bash

# Server-only - HMAC key for public-viewer unlock cookies (any long random string)
ACCESS_TOKEN_SECRET="replace-with-long-random-string"
```

- [ ] **Step 2: Append a real random value to `.env.local`**

Generate one and add the line (do NOT commit `.env.local`):
```bash
node -e "console.log('ACCESS_TOKEN_SECRET=\"'+require('crypto').randomBytes(32).toString('hex')+'\"')" >> .env.local
```

- [ ] **Step 3: Confirm `.env.local` is still ignored**

Run: `git status --short`
Expected: `.env.local` does NOT appear; `.env.example` appears as modified.

- [ ] **Step 4: Commit (example only)**

```bash
git add .env.example
git commit -m "chore: add ACCESS_TOKEN_SECRET env placeholder"
```

---

## Task 3: Storage foundation — service client, constants, helpers, bucket

**Files:**
- Create: `lib/supabase/service.ts`, `lib/proposals/constants.ts`, `lib/proposals/storage.ts`, `scripts/setup-bucket.mts`
- Test: `tests/proposals/constants.test.ts`

- [ ] **Step 1: Write the failing test `tests/proposals/constants.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { extForContentType, pagePath, ALLOWED_IMAGE_TYPES } from "@/lib/proposals/constants";

describe("proposal storage constants", () => {
  it("maps allowed content types to extensions", () => {
    expect(extForContentType("image/png")).toBe("png");
    expect(extForContentType("image/jpeg")).toBe("jpg");
    expect(extForContentType("image/webp")).toBe("webp");
  });
  it("rejects disallowed content types", () => {
    expect(extForContentType("image/gif")).toBeNull();
    expect(extForContentType("application/pdf")).toBeNull();
  });
  it("exposes the allowed type list", () => {
    expect(ALLOWED_IMAGE_TYPES).toContain("image/png");
    expect(ALLOWED_IMAGE_TYPES).toHaveLength(3);
  });
  it("builds a deterministic object path", () => {
    expect(pagePath("p1", "v1", "pg1", "png")).toBe("p1/v1/pg1.png");
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npm test -- constants`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/proposals/constants.ts` (pure, client-safe — no server imports)**

```ts
export const PROPOSALS_BUCKET = "proposals";
export const MAX_PAGE_BYTES = 25 * 1024 * 1024; // 25MB per page

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const ALLOWED_IMAGE_TYPES = Object.keys(EXT_BY_TYPE);

export function extForContentType(contentType: string): string | null {
  return EXT_BY_TYPE[contentType] ?? null;
}

export function pagePath(proposalId: string, versionId: string, pageId: string, ext: string): string {
  return `${proposalId}/${versionId}/${pageId}.${ext}`;
}
```

- [ ] **Step 4: Run it, verify pass**

Run: `npm test -- constants`
Expected: PASS.

- [ ] **Step 5: Create `lib/supabase/service.ts`**

```ts
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS/Storage policies. Use ONLY in server code
// after an explicit auth/permission check. Never import from client components.
export function createSupabaseService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

- [ ] **Step 6: Create `lib/proposals/storage.ts` (server only)**

```ts
import { createSupabaseService } from "@/lib/supabase/service";
import { PROPOSALS_BUCKET } from "@/lib/proposals/constants";

export async function createUploadUrl(path: string) {
  const supabase = createSupabaseService();
  const { data, error } = await supabase.storage.from(PROPOSALS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`createSignedUploadUrl failed: ${error?.message ?? "no data"}`);
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export async function createReadUrl(path: string, expiresIn = 3600) {
  const supabase = createSupabaseService();
  const { data, error } = await supabase.storage.from(PROPOSALS_BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(`createSignedUrl failed: ${error?.message ?? "no data"}`);
  return data.signedUrl;
}

export async function removeObjects(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = createSupabaseService();
  const { error } = await supabase.storage.from(PROPOSALS_BUCKET).remove(paths);
  if (error) throw new Error(`storage remove failed: ${error.message}`);
}
```

- [ ] **Step 7: Create `scripts/setup-bucket.mts` and create the private bucket**

```ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const { data: existing } = await supabase.storage.getBucket("proposals");
if (existing) {
  console.log("bucket 'proposals' already exists:", { public: existing.public });
} else {
  const { error } = await supabase.storage.createBucket("proposals", { public: false });
  if (error) throw error;
  console.log("created private bucket 'proposals'");
}
```
Run: `npx tsx --env-file=.env.local scripts/setup-bucket.mts`
Expected: prints created (or already exists) with `public: false`. (Alternatively create it in the Supabase dashboard: Storage → New bucket → name `proposals`, Public = off.)

- [ ] **Step 8: Verify a signed upload+read round-trip**

Create a throwaway check inline:
```bash
npx tsx --env-file=.env.local -e "import('@supabase/supabase-js').then(async ({createClient})=>{const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY);const up=await s.storage.from('proposals').createSignedUploadUrl('selftest/ping.txt');if(up.error)throw up.error;const u=await s.storage.from('proposals').uploadToSignedUrl('selftest/ping.txt',up.data.token,new Blob(['ok']));if(u.error)throw u.error;const r=await s.storage.from('proposals').createSignedUrl('selftest/ping.txt',60);console.log('signed read ok:',!!r.data?.signedUrl);await s.storage.from('proposals').remove(['selftest/ping.txt']);})"
```
Expected: `signed read ok: true`.

- [ ] **Step 9: Commit**

```bash
git add lib/supabase/service.ts lib/proposals/constants.ts lib/proposals/storage.ts scripts/setup-bucket.mts tests/proposals/constants.test.ts
git commit -m "feat: add storage service client, constants, signed-url helpers, bucket"
```

---

## Task 4: `public_id` generator (pure, TDD)

**Files:**
- Create: `lib/proposals/public-id.ts`
- Test: `tests/proposals/public-id.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { generatePublicId, PUBLIC_ID_LENGTH, PUBLIC_ID_ALPHABET } from "@/lib/proposals/public-id";

describe("generatePublicId", () => {
  it("returns a string of the configured length", () => {
    expect(generatePublicId()).toHaveLength(PUBLIC_ID_LENGTH);
  });
  it("uses only the unambiguous alphabet", () => {
    const re = new RegExp(`^[${PUBLIC_ID_ALPHABET}]+$`);
    for (let i = 0; i < 200; i++) expect(generatePublicId()).toMatch(re);
  });
  it("excludes ambiguous characters 0/1/o/i/l", () => {
    expect(PUBLIC_ID_ALPHABET).not.toMatch(/[01oil]/);
  });
  it("produces varied output", () => {
    const set = new Set(Array.from({ length: 50 }, () => generatePublicId()));
    expect(set.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npm test -- public-id`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/proposals/public-id.ts`**

```ts
import { randomInt } from "node:crypto";

// No 0/1/o/i/l to avoid visual ambiguity in shared URLs.
export const PUBLIC_ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const PUBLIC_ID_LENGTH = 8;

export function generatePublicId(length = PUBLIC_ID_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PUBLIC_ID_ALPHABET[randomInt(PUBLIC_ID_ALPHABET.length)];
  }
  return out;
}
```

- [ ] **Step 4: Run it, verify pass**

Run: `npm test -- public-id`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/proposals/public-id.ts tests/proposals/public-id.test.ts
git commit -m "feat: add public_id generator"
```

---

## Task 5: Password hashing (pure, TDD)

**Files:**
- Create: `lib/access/password.ts`
- Test: `tests/access/password.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/access/password";

describe("password hashing", () => {
  it("verifies the correct password", () => {
    const stored = hashPassword("hunter2!");
    expect(verifyPassword("hunter2!", stored)).toBe(true);
  });
  it("rejects a wrong password", () => {
    const stored = hashPassword("hunter2!");
    expect(verifyPassword("nope", stored)).toBe(false);
  });
  it("uses a random salt (two hashes of same password differ)", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });
  it("rejects malformed stored values", () => {
    expect(verifyPassword("x", "garbage")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npm test -- password`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/access/password.ts`**

```ts
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

// Stored format: "<saltHex>:<hashHex>". Plaintext is never stored.
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== computed.length) return false;
  return timingSafeEqual(expected, computed);
}
```

- [ ] **Step 4: Run it, verify pass**

Run: `npm test -- password`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/access/password.ts tests/access/password.test.ts
git commit -m "feat: add scrypt password hash/verify"
```

---

## Task 6: Unlock cookie sign/verify (pure, TDD)

**Files:**
- Create: `lib/access/cookie.ts`
- Test: `tests/access/cookie.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { signUnlockToken, verifyUnlockToken, unlockCookieName } from "@/lib/access/cookie";

const SECRET = "test-secret";
const NOW = 1_000_000; // epoch seconds (fixed for determinism)

describe("unlock cookie tokens", () => {
  it("verifies a freshly signed token", () => {
    const token = signUnlockToken("abc123", NOW + 3600, SECRET);
    expect(verifyUnlockToken(token, "abc123", NOW, SECRET)).toBe(true);
  });
  it("rejects a token for a different publicId", () => {
    const token = signUnlockToken("abc123", NOW + 3600, SECRET);
    expect(verifyUnlockToken(token, "other99", NOW, SECRET)).toBe(false);
  });
  it("rejects an expired token", () => {
    const token = signUnlockToken("abc123", NOW - 1, SECRET);
    expect(verifyUnlockToken(token, "abc123", NOW, SECRET)).toBe(false);
  });
  it("rejects a tampered signature", () => {
    const token = signUnlockToken("abc123", NOW + 3600, SECRET);
    expect(verifyUnlockToken(token + "ff", "abc123", NOW, SECRET)).toBe(false);
  });
  it("rejects a token signed with a different secret", () => {
    const token = signUnlockToken("abc123", NOW + 3600, SECRET);
    expect(verifyUnlockToken(token, "abc123", NOW, "wrong")).toBe(false);
  });
  it("scopes the cookie name to the publicId", () => {
    expect(unlockCookieName("abc123")).toBe("pu_abc123");
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npm test -- cookie`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/access/cookie.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const UNLOCK_TTL_SECONDS = 12 * 60 * 60; // 12h

export function unlockCookieName(publicId: string): string {
  return `pu_${publicId}`;
}

// Token format: "<publicId>.<expEpochSec>.<hmacHex>"
export function signUnlockToken(publicId: string, expEpochSec: number, secret: string): string {
  const payload = `${publicId}.${expEpochSec}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyUnlockToken(
  token: string,
  publicId: string,
  nowEpochSec: number,
  secret: string,
): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [pid, expStr, sig] = parts;
  if (pid !== publicId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < nowEpochSec) return false;
  const expected = createHmac("sha256", secret).update(`${pid}.${expStr}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run it, verify pass**

Run: `npm test -- cookie`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/access/cookie.ts tests/access/cookie.test.ts
git commit -m "feat: add HMAC unlock cookie sign/verify"
```

---

## Task 7: Access decision (pure, TDD)

**Files:**
- Create: `lib/proposals/access.ts`
- Test: `tests/proposals/access.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { decideAccess } from "@/lib/proposals/access";

describe("decideAccess", () => {
  it("allows editors regardless of visibility", () => {
    expect(decideAccess({ visibility: "private", hasPassword: true, isEditor: true, hasValidUnlock: false })).toBe("allow");
  });
  it("forbids non-editors on private", () => {
    expect(decideAccess({ visibility: "private", hasPassword: false, isEditor: false, hasValidUnlock: false })).toBe("forbidden");
  });
  it("allows anyone on public without a password", () => {
    expect(decideAccess({ visibility: "public", hasPassword: false, isEditor: false, hasValidUnlock: false })).toBe("allow");
  });
  it("requires password on public+password without unlock", () => {
    expect(decideAccess({ visibility: "public", hasPassword: true, isEditor: false, hasValidUnlock: false })).toBe("need-password");
  });
  it("allows public+password once unlocked", () => {
    expect(decideAccess({ visibility: "public", hasPassword: true, isEditor: false, hasValidUnlock: true })).toBe("allow");
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npm test -- access`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/proposals/access.ts`**

```ts
export type AccessDecision = "allow" | "need-password" | "forbidden";

export function decideAccess(input: {
  visibility: string;
  hasPassword: boolean;
  isEditor: boolean;
  hasValidUnlock: boolean;
}): AccessDecision {
  if (input.isEditor) return "allow";
  if (input.visibility !== "public") return "forbidden";
  if (!input.hasPassword) return "allow";
  return input.hasValidUnlock ? "allow" : "need-password";
}
```

- [ ] **Step 4: Run it, verify pass**

Run: `npm test -- access`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/proposals/access.ts tests/proposals/access.test.ts
git commit -m "feat: add proposal access decision helper"
```

---

## Task 8: API — list + create proposal (`/api/proposals`)

**Files:**
- Create: `app/api/proposals/route.ts`

- [ ] **Step 1: Implement `app/api/proposals/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVersions } from "@/drizzle/schema";
import { requireEditor } from "@/lib/auth/session";
import { generatePublicId } from "@/lib/proposals/public-id";
import { extForContentType, pagePath, MAX_PAGE_BYTES } from "@/lib/proposals/constants";
import { createUploadUrl } from "@/lib/proposals/storage";

export async function GET() {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const rows = await db.select().from(proposals).orderBy(desc(proposals.updatedAt));
  return NextResponse.json(rows);
}

type FileSpec = { contentType: string; size: number };

export async function POST(req: NextRequest) {
  let editor;
  try {
    editor = await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const files: FileSpec[] = Array.isArray(body.files) ? body.files : [];
  if (!title) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });

  for (const f of files) {
    if (!extForContentType(String(f.contentType))) {
      return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
    }
    if (Number(f.size) > MAX_PAGE_BYTES) {
      return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
    }
  }

  let publicId = "";
  for (let i = 0; i < 5; i++) {
    const cand = generatePublicId();
    const exists = await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.publicId, cand)).limit(1);
    if (exists.length === 0) { publicId = cand; break; }
  }
  if (!publicId) return NextResponse.json({ error: "ID_GENERATION_FAILED" }, { status: 500 });

  const proposalId = randomUUID();
  const versionId = randomUUID();
  await db.insert(proposals).values({ id: proposalId, publicId, title, ownerId: editor.id });
  await db.insert(proposalVersions).values({ id: versionId, proposalId, versionNo: 1, createdBy: editor.id });

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(String(files[i].contentType))!;
    const pageId = randomUUID();
    const path = pagePath(proposalId, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({ pageId, path, token: signed.token, signedUrl: signed.signedUrl, pageOrder: i });
  }

  return NextResponse.json({ proposalId, publicId, versionId, uploads });
}
```

- [ ] **Step 2: Verify auth gate + create (curl, while dev server running)**

Run `npm run dev`. As an admin/editor (logged in via browser; copy the session cookie or use the browser later in Task 15). For now verify the FORBIDDEN path without a session:
```bash
curl -s -X POST http://localhost:3000/api/proposals -H "Content-Type: application/json" -d '{"title":"t","files":[]}'
```
Expected: `{"error":"FORBIDDEN"}` (HTTP 403). Full create is verified end-to-end in Task 15.

- [ ] **Step 3: Commit**

```bash
git add app/api/proposals/route.ts
git commit -m "feat: add proposals list + create API"
```

---

## Task 9: API — confirm uploaded pages

**Files:**
- Create: `app/api/proposals/[id]/versions/[vid]/pages/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVersions, proposalPages } from "@/drizzle/schema";
import { requireEditor } from "@/lib/auth/session";

type PageInput = { pageId: string; pageOrder: number; path: string; width: number; height: number };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> },
) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id, vid } = await params;
  const ver = await db.select().from(proposalVersions)
    .where(and(eq(proposalVersions.id, vid), eq(proposalVersions.proposalId, id)))
    .limit(1);
  if (ver.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json();
  const pages: PageInput[] = Array.isArray(body.pages) ? body.pages : [];
  if (pages.length === 0) return NextResponse.json({ error: "NO_PAGES" }, { status: 400 });

  await db.insert(proposalPages).values(
    pages.map((p) => ({
      id: String(p.pageId),
      versionId: vid,
      pageOrder: Number(p.pageOrder),
      storagePath: String(p.path),
      width: Number(p.width),
      height: Number(p.height),
    })),
  );
  await db.update(proposals).set({ currentVersionId: vid, updatedAt: new Date() }).where(eq(proposals.id, id));

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (End-to-end verified in Task 15.)

- [ ] **Step 3: Commit**

```bash
git add app/api/proposals/[id]/versions/[vid]/pages/route.ts
git commit -m "feat: add confirm-pages API (records pages, sets current version)"
```

---

## Task 10: API — new version

**Files:**
- Create: `app/api/proposals/[id]/versions/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVersions } from "@/drizzle/schema";
import { requireEditor } from "@/lib/auth/session";
import { extForContentType, pagePath, MAX_PAGE_BYTES } from "@/lib/proposals/constants";
import { createUploadUrl } from "@/lib/proposals/storage";

type FileSpec = { contentType: string; size: number };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let editor;
  try {
    editor = await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  const proposal = await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.id, id)).limit(1);
  if (proposal.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json();
  const note = body.note ? String(body.note).trim() : null;
  const files: FileSpec[] = Array.isArray(body.files) ? body.files : [];
  if (files.length === 0) return NextResponse.json({ error: "NO_FILES" }, { status: 400 });
  for (const f of files) {
    if (!extForContentType(String(f.contentType))) return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
    if (Number(f.size) > MAX_PAGE_BYTES) return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
  }

  const last = await db.select({ v: proposalVersions.versionNo }).from(proposalVersions)
    .where(eq(proposalVersions.proposalId, id)).orderBy(desc(proposalVersions.versionNo)).limit(1);
  const nextNo = (last[0]?.v ?? 0) + 1;

  const versionId = randomUUID();
  await db.insert(proposalVersions).values({ id: versionId, proposalId: id, versionNo: nextNo, note, createdBy: editor.id });

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(String(files[i].contentType))!;
    const pageId = randomUUID();
    const path = pagePath(id, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({ pageId, path, token: signed.token, signedUrl: signed.signedUrl, pageOrder: i });
  }

  return NextResponse.json({ versionId, versionNo: nextNo, uploads });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/proposals/[id]/versions/route.ts
git commit -m "feat: add new-version API"
```

---

## Task 11: API — get / patch (settings) / delete

**Files:**
- Create: `app/api/proposals/[id]/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVersions, proposalPages } from "@/drizzle/schema";
import { requireEditor } from "@/lib/auth/session";
import { hashPassword } from "@/lib/access/password";
import { removeObjects } from "@/lib/proposals/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  if (rows.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const versions = await db.select().from(proposalVersions)
    .where(eq(proposalVersions.proposalId, id)).orderBy(asc(proposalVersions.versionNo));
  return NextResponse.json({ proposal: rows[0], versions });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();

  const updates: Partial<typeof proposals.$inferInsert> = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
    updates.title = t;
  }
  if (typeof body.visibility === "string") {
    if (body.visibility !== "private" && body.visibility !== "public") {
      return NextResponse.json({ error: "INVALID_VISIBILITY" }, { status: 400 });
    }
    updates.visibility = body.visibility;
  }
  if ("password" in body) {
    if (body.password === null) {
      updates.accessPasswordHash = null;
    } else if (typeof body.password === "string" && body.password.length >= 4) {
      updates.accessPasswordHash = hashPassword(body.password);
    } else {
      return NextResponse.json({ error: "INVALID_PASSWORD" }, { status: 400 });
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "NO_CHANGES" }, { status: 400 });
  }
  updates.updatedAt = new Date();
  await db.update(proposals).set(updates).where(eq(proposals.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  const pages = await db.select({ path: proposalPages.storagePath }).from(proposalPages)
    .innerJoin(proposalVersions, eq(proposalPages.versionId, proposalVersions.id))
    .where(eq(proposalVersions.proposalId, id));
  const paths = [...new Set(pages.map((p) => p.path))];
  await removeObjects(paths); // best-effort cleanup before row delete
  await db.delete(proposals).where(eq(proposals.id, id)); // cascade removes versions + pages
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/proposals/[id]/route.ts
git commit -m "feat: add proposal get/patch(settings)/delete API"
```

---

## Task 12: API — restore version (non-destructive copy)

**Files:**
- Create: `app/api/proposals/[id]/restore/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVersions, proposalPages } from "@/drizzle/schema";
import { requireEditor } from "@/lib/auth/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let editor;
  try {
    editor = await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const versionId = String(body.versionId ?? "");

  const src = await db.select().from(proposalVersions)
    .where(and(eq(proposalVersions.id, versionId), eq(proposalVersions.proposalId, id)))
    .limit(1);
  if (src.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const srcPages = await db.select().from(proposalPages)
    .where(eq(proposalPages.versionId, versionId)).orderBy(asc(proposalPages.pageOrder));

  const last = await db.select({ v: proposalVersions.versionNo }).from(proposalVersions)
    .where(eq(proposalVersions.proposalId, id)).orderBy(desc(proposalVersions.versionNo)).limit(1);
  const nextNo = (last[0]?.v ?? 0) + 1;

  const newVid = randomUUID();
  await db.insert(proposalVersions).values({
    id: newVid,
    proposalId: id,
    versionNo: nextNo,
    note: `v${src[0].versionNo}에서 복원`,
    createdBy: editor.id,
  });
  if (srcPages.length > 0) {
    // Reuse the same storage objects (no re-upload) — copy only the rows.
    await db.insert(proposalPages).values(
      srcPages.map((p) => ({
        id: randomUUID(),
        versionId: newVid,
        pageOrder: p.pageOrder,
        storagePath: p.storagePath,
        width: p.width,
        height: p.height,
      })),
    );
  }
  await db.update(proposals).set({ currentVersionId: newVid, updatedAt: new Date() }).where(eq(proposals.id, id));

  return NextResponse.json({ ok: true, versionId: newVid, versionNo: nextNo });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/proposals/[id]/restore/route.ts
git commit -m "feat: add restore-version API (non-destructive copy)"
```

---

## Task 13: Client upload helpers + create/add-version forms

**Files:**
- Create: `lib/proposals/upload-client.ts`, `components/proposals/proposal-create-form.tsx`, `components/proposals/add-version-form.tsx`

- [ ] **Step 1: Create `lib/proposals/upload-client.ts` (browser only — imports constants only)**

```ts
"use client";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { PROPOSALS_BUCKET } from "@/lib/proposals/constants";

export type MeasuredFile = { file: File; width: number; height: number };
export type UploadSpec = { pageId: string; path: string; token: string; pageOrder: number };
export type ConfirmPage = { pageId: string; pageOrder: number; path: string; width: number; height: number };

export async function measureImage(file: File): Promise<MeasuredFile> {
  const bitmap = await createImageBitmap(file);
  const measured = { file, width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return measured;
}

export async function measureAll(files: File[]): Promise<MeasuredFile[]> {
  return Promise.all(files.map(measureImage));
}

// Upload each file to its signed URL, returning the confirm payload (pageOrder maps to measured[]).
export async function uploadAll(uploads: UploadSpec[], measured: MeasuredFile[]): Promise<ConfirmPage[]> {
  const supabase = createSupabaseBrowser();
  const pages: ConfirmPage[] = [];
  for (const u of uploads) {
    const m = measured[u.pageOrder];
    const { error } = await supabase.storage.from(PROPOSALS_BUCKET).uploadToSignedUrl(u.path, u.token, m.file);
    if (error) throw new Error(`upload failed (page ${u.pageOrder + 1}): ${error.message}`);
    pages.push({ pageId: u.pageId, pageOrder: u.pageOrder, path: u.path, width: m.width, height: m.height });
  }
  return pages;
}
```

- [ ] **Step 2: Create `components/proposals/proposal-create-form.tsx`**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALLOWED_IMAGE_TYPES } from "@/lib/proposals/constants";
import { measureAll, uploadAll } from "@/lib/proposals/upload-client";

export function ProposalCreateForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
    const files = Array.from((form.elements.namedItem("files") as HTMLInputElement).files ?? []);
    if (!title) { setError("제목을 입력하세요."); return; }
    if (files.length === 0) { setError("이미지를 1개 이상 선택하세요."); return; }

    setBusy(true);
    try {
      const measured = await measureAll(files);
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, files: files.map((f) => ({ contentType: f.type, size: f.size })) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "생성 실패");
      const { proposalId, versionId, uploads } = await res.json();
      const pages = await uploadAll(uploads, measured);
      const confirm = await fetch(`/api/proposals/${proposalId}/versions/${versionId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages }),
      });
      if (!confirm.ok) throw new Error((await confirm.json()).error ?? "페이지 저장 실패");
      router.push(`/dashboard/proposals/${proposalId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="files">이미지 (여러 장 선택 가능, 순서대로 페이지가 됩니다)</Label>
        <Input id="files" name="files" type="file" multiple accept={ALLOWED_IMAGE_TYPES.join(",")} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "업로드 중…" : "시안 만들기"}</Button>
    </form>
  );
}
```

- [ ] **Step 3: Create `components/proposals/add-version-form.tsx`**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALLOWED_IMAGE_TYPES } from "@/lib/proposals/constants";
import { measureAll, uploadAll } from "@/lib/proposals/upload-client";

export function AddVersionForm({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const note = (form.elements.namedItem("note") as HTMLInputElement).value.trim();
    const files = Array.from((form.elements.namedItem("files") as HTMLInputElement).files ?? []);
    if (files.length === 0) { setError("이미지를 1개 이상 선택하세요."); return; }

    setBusy(true);
    try {
      const measured = await measureAll(files);
      const res = await fetch(`/api/proposals/${proposalId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, files: files.map((f) => ({ contentType: f.type, size: f.size })) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "버전 생성 실패");
      const { versionId, uploads } = await res.json();
      const pages = await uploadAll(uploads, measured);
      const confirm = await fetch(`/api/proposals/${proposalId}/versions/${versionId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages }),
      });
      if (!confirm.ok) throw new Error((await confirm.json()).error ?? "페이지 저장 실패");
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="note">변경 메모 (선택)</Label>
        <Input id="note" name="note" placeholder="예: 메인 컬러 변경" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="files">새 버전 이미지</Label>
        <Input id="files" name="files" type="file" multiple accept={ALLOWED_IMAGE_TYPES.join(",")} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "업로드 중…" : "새 버전 올리기"}</Button>
    </form>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/proposals/upload-client.ts components/proposals/proposal-create-form.tsx components/proposals/add-version-form.tsx
git commit -m "feat: add client upload helpers + create/add-version forms"
```

---

## Task 14: Dashboard — proposals list page

**Files:**
- Create: `app/(dashboard)/dashboard/proposals/page.tsx`

> Route group `(dashboard)` adds no URL segment, so this resolves to `/dashboard/proposals` — matching the sidebar link in `app/(dashboard)/layout.tsx` and the proxy's `/dashboard` protection.

- [ ] **Step 1: Implement the list page**

```tsx
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals } from "@/drizzle/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ProposalsPage() {
  const rows = await db.select().from(proposals).orderBy(desc(proposals.updatedAt));
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">시안</h1>
        <Button asChild><Link href="/dashboard/proposals/new">새 시안</Link></Button>
      </div>
      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>제목</TableHead>
            <TableHead>공개 ID</TableHead>
            <TableHead>공개 상태</TableHead>
            <TableHead className="text-right">링크</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-muted-foreground">아직 시안이 없습니다.</TableCell></TableRow>
          )}
          {rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link href={`/dashboard/proposals/${p.id}`} className="underline">{p.title}</Link>
              </TableCell>
              <TableCell className="font-mono text-xs">{p.publicId}</TableCell>
              <TableCell>
                <Badge variant={p.visibility === "public" ? "default" : "outline"}>
                  {p.visibility === "public" ? (p.accessPasswordHash ? "공개+비번" : "공개") : "비공개"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/p/${p.publicId}`} className="text-sm underline" target="_blank">뷰어 열기</Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npm run dev`, log in as an editor/admin, visit `/dashboard/proposals`.
Expected: heading + "새 시안" button + empty-state row. Stop server.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/dashboard/proposals/page.tsx
git commit -m "feat: add proposals list page"
```

---

## Task 15: Dashboard — new proposal page (end-to-end upload)

**Files:**
- Create: `app/(dashboard)/dashboard/proposals/new/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
import { ProposalCreateForm } from "@/components/proposals/proposal-create-form";

export default function NewProposalPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">새 시안</h1>
      <p className="mt-2 text-sm text-muted-foreground">제목과 이미지를 올리면 v1이 자동 생성됩니다.</p>
      <div className="mt-6">
        <ProposalCreateForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: End-to-end create verification**

Run `npm run dev`, log in as editor/admin, go to `/dashboard/proposals/new`. Enter a title, select 2 PNG/JPG images, submit.
Expected: redirects to `/dashboard/proposals/<id>`. Verify rows landed:
```bash
npx tsx --env-file=.env.local -e "import('postgres').then(async ({default:p})=>{const s=p(process.env.DATABASE_URL,{prepare:false});const pr=await s\`select id,public_id,title,current_version_id from proposals order by created_at desc limit 1\`;console.log('proposal',pr[0]);const pg=await s\`select page_order,width,height,storage_path from proposal_pages order by page_order\`;console.log('pages',pg);await s.end();})"
```
Expected: the proposal has a non-null `current_version_id`; pages list shows ordered rows with real width/height.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/dashboard/proposals/new/page.tsx
git commit -m "feat: add new-proposal page"
```

---

## Task 16: Dashboard — proposal detail (preview, versions, settings, delete)

**Files:**
- Create: `app/(dashboard)/dashboard/proposals/[id]/page.tsx`, `components/proposals/version-actions.tsx`, `components/proposals/proposal-settings.tsx`

- [ ] **Step 1: Create `components/proposals/version-actions.tsx` (restore button)**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function RestoreButton({ proposalId, versionId, isCurrent }: { proposalId: string; versionId: string; isCurrent: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (isCurrent) return <span className="text-xs text-muted-foreground">현재 버전</span>;
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() =>
      start(async () => {
        const res = await fetch(`/api/proposals/${proposalId}/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId }),
        });
        if (res.ok) router.refresh();
      })
    }>복원</Button>
  );
}
```

- [ ] **Step 2: Create `components/proposals/proposal-settings.tsx` (visibility / password / delete)**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProposalSettings({
  proposalId,
  visibility,
  hasPassword,
}: { proposalId: string; visibility: string; hasPassword: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function patch(payload: Record<string, unknown>) {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) setError((await res.json()).error ?? "변경 실패");
      else router.refresh();
    });
  }

  function onSetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pw = (e.currentTarget.elements.namedItem("password") as HTMLInputElement).value;
    patch({ password: pw });
    e.currentTarget.reset();
  }

  function onDelete() {
    if (!confirm("이 시안을 삭제할까요? 모든 버전과 이미지가 사라집니다.")) return;
    start(async () => {
      const res = await fetch(`/api/proposals/${proposalId}`, { method: "DELETE" });
      if (res.ok) { router.push("/dashboard/proposals"); router.refresh(); }
      else setError((await res.json()).error ?? "삭제 실패");
    });
  }

  return (
    <div className="space-y-4 rounded-[8px] border border-border p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm">공개 상태:</span>
        <Button size="sm" variant={visibility === "private" ? "default" : "outline"} disabled={pending}
          onClick={() => patch({ visibility: "private" })}>비공개</Button>
        <Button size="sm" variant={visibility === "public" ? "default" : "outline"} disabled={pending}
          onClick={() => patch({ visibility: "public" })}>공개</Button>
      </div>

      <form onSubmit={onSetPassword} className="space-y-2">
        <Label htmlFor="password">접근 비밀번호 {hasPassword && <span className="text-xs text-muted-foreground">(설정됨)</span>}</Label>
        <div className="flex gap-2">
          <Input id="password" name="password" type="password" minLength={4} placeholder="4자 이상" />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>설정/변경</Button>
          {hasPassword && (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => patch({ password: null })}>비번 해제</Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">비밀번호는 공개 시안에만 적용됩니다.</p>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="border-t border-border pt-4">
        <Button variant="destructive" size="sm" disabled={pending} onClick={onDelete}>시안 삭제</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the detail page `app/(dashboard)/dashboard/proposals/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVersions, proposalPages } from "@/drizzle/schema";
import { createReadUrl } from "@/lib/proposals/storage";
import { AddVersionForm } from "@/components/proposals/add-version-form";
import { RestoreButton } from "@/components/proposals/version-actions";
import { ProposalSettings } from "@/components/proposals/proposal-settings";
import { Badge } from "@/components/ui/badge";

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  const proposal = rows[0];
  if (!proposal) notFound();

  const versions = await db.select().from(proposalVersions)
    .where(eq(proposalVersions.proposalId, id)).orderBy(asc(proposalVersions.versionNo));

  const currentPages = proposal.currentVersionId
    ? await db.select().from(proposalPages)
        .where(eq(proposalPages.versionId, proposal.currentVersionId)).orderBy(asc(proposalPages.pageOrder))
    : [];
  const previews = await Promise.all(currentPages.map(async (pg) => ({ id: pg.id, url: await createReadUrl(pg.storagePath) })));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{proposal.title}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">/p/{proposal.publicId}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">설정</h2>
        <ProposalSettings proposalId={proposal.id} visibility={proposal.visibility} hasPassword={!!proposal.accessPasswordHash} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">버전 히스토리</h2>
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between rounded-[8px] border border-border px-4 py-2">
              <span className="text-sm">
                v{v.versionNo}{v.note ? ` — ${v.note}` : ""}
                {v.id === proposal.currentVersionId && <Badge className="ml-2" variant="outline">current</Badge>}
              </span>
              <RestoreButton proposalId={proposal.id} versionId={v.id} isCurrent={v.id === proposal.currentVersionId} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">새 버전</h2>
        <AddVersionForm proposalId={proposal.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">현재 버전 미리보기</h2>
        {previews.length === 0 && <p className="text-sm text-muted-foreground">페이지가 없습니다.</p>}
        <div className="space-y-4">
          {previews.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt="" className="max-w-full border border-border" />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Verify detail + restore + new version + settings**

Run `npm run dev`. Open the proposal from Task 15. Confirm: pages preview render (signed URLs), version list shows v1 (current). Upload a new version → v2 becomes current, preview updates. Click 복원 on v1 → v3 appears as current with note "v1에서 복원". Toggle 공개, set a password, then 비번 해제.
Expected: each action refreshes and reflects in the UI.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/dashboard/proposals/[id]/page.tsx components/proposals/version-actions.tsx components/proposals/proposal-settings.tsx
git commit -m "feat: add proposal detail (preview, versions, restore, settings, delete)"
```

---

## Task 17: Public viewer + unlock

**Files:**
- Create: `app/p/[publicId]/page.tsx`, `app/p/[publicId]/actions.ts`

- [ ] **Step 1: Create the unlock server action `app/p/[publicId]/actions.ts`**

```ts
"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals } from "@/drizzle/schema";
import { verifyPassword } from "@/lib/access/password";
import { signUnlockToken, unlockCookieName, UNLOCK_TTL_SECONDS } from "@/lib/access/cookie";

export async function unlock(publicId: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const rows = await db.select().from(proposals).where(eq(proposals.publicId, publicId)).limit(1);
  const proposal = rows[0];
  if (!proposal || proposal.visibility !== "public" || !proposal.accessPasswordHash) {
    redirect(`/p/${publicId}`);
  }
  if (!verifyPassword(password, proposal.accessPasswordHash)) {
    redirect(`/p/${publicId}?error=1`);
  }
  const exp = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SECONDS;
  const token = signUnlockToken(publicId, exp, process.env.ACCESS_TOKEN_SECRET!);
  const store = await cookies();
  store.set(unlockCookieName(publicId), token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: `/p/${publicId}`,
    maxAge: UNLOCK_TTL_SECONDS,
  });
  redirect(`/p/${publicId}`);
}
```

- [ ] **Step 2: Create the viewer `app/p/[publicId]/page.tsx`**

```tsx
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalPages } from "@/drizzle/schema";
import { getProfile } from "@/lib/auth/session";
import { isEditor, type Role } from "@/lib/auth/roles";
import { decideAccess } from "@/lib/proposals/access";
import { verifyUnlockToken, unlockCookieName } from "@/lib/access/cookie";
import { createReadUrl } from "@/lib/proposals/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { unlock } from "./actions";

export default async function PublicViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { publicId } = await params;
  const { error } = await searchParams;

  const rows = await db.select().from(proposals).where(eq(proposals.publicId, publicId)).limit(1);
  const proposal = rows[0];
  if (!proposal) notFound();

  const profile = await getProfile();
  const editor = isEditor(profile?.role as Role | undefined);

  const cookieStore = await cookies();
  const token = cookieStore.get(unlockCookieName(publicId))?.value ?? "";
  const hasValidUnlock = !!token &&
    verifyUnlockToken(token, publicId, Math.floor(Date.now() / 1000), process.env.ACCESS_TOKEN_SECRET!);

  const decision = decideAccess({
    visibility: proposal.visibility,
    hasPassword: !!proposal.accessPasswordHash,
    isEditor: editor,
    hasValidUnlock,
  });

  if (decision === "forbidden") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-xl font-semibold">비공개 시안</h1>
        <p className="text-sm text-muted-foreground">이 시안은 비공개입니다. 편집자 로그인이 필요합니다.</p>
        <a href="/login" className="text-sm underline">로그인</a>
      </div>
    );
  }

  if (decision === "need-password") {
    const unlockWithId = unlock.bind(null, publicId);
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-sm p-8">
          <h1 className="text-xl font-semibold tracking-tight">{proposal.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">비밀번호가 필요한 시안입니다.</p>
          <form action={unlockWithId} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error && <p className="text-sm text-destructive">비밀번호가 올바르지 않습니다.</p>}
            <Button type="submit" className="w-full">열기</Button>
          </form>
        </Card>
      </div>
    );
  }

  // decision === "allow"
  const pages = proposal.currentVersionId
    ? await db.select().from(proposalPages)
        .where(eq(proposalPages.versionId, proposal.currentVersionId)).orderBy(asc(proposalPages.pageOrder))
    : [];
  const previews = await Promise.all(pages.map(async (pg) => ({ id: pg.id, url: await createReadUrl(pg.storagePath) })));

  return (
    <div className="mx-auto max-w-[1920px]">
      {previews.length === 0 && <p className="p-8 text-sm text-muted-foreground">아직 페이지가 없습니다.</p>}
      {previews.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p.id} src={p.url} alt="" className="block w-full" />
      ))}
    </div>
  );
}
```

> Note: this is the **minimal render** (vertical stack). The 1920-fixed fullscreen slide + canvas view are Phase 2.

- [ ] **Step 3: Verify the three access paths**

Run `npm run dev`.
1. **public, no password:** set the proposal to 공개 (no password) in the dashboard, open `/p/<publicId>` in a logged-out browser/incognito → pages render.
2. **public + password:** set a password, reopen incognito → password form. Wrong password → error message. Correct password → pages render; reload stays unlocked (cookie).
3. **private:** set to 비공개, open incognito → "비공개 시안" message. As a logged-in editor → pages render.

- [ ] **Step 4: Commit**

```bash
git add app/p/[publicId]/page.tsx app/p/[publicId]/actions.ts
git commit -m "feat: add public viewer + password unlock gate"
```

---

## Task 18: Finalize — build, full test, manual sweep

**Files:**
- (No new files; verification + any small fixes.)

- [ ] **Step 1: Confirm the sidebar link points to the list**

Open `app/(dashboard)/layout.tsx` and confirm the 시안 nav link is `href="/dashboard/proposals"`. (It already is from Phase 1a; fix it if not.)

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all suites pass (smoke, roles, constants, public-id, password, cookie, access).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 4: End-to-end manual sweep**

With `npm run dev`, as an editor:
- Create a proposal with 3 images → lands on detail, pages preview.
- Add a v2, restore v1 (→ v3 current).
- Toggle public, set/clear password.
- Open `/p/<publicId>` in incognito for each visibility state (private blocked, public open, public+password gated).
- Delete the proposal → list no longer shows it; confirm storage objects are gone:
```bash
npx tsx --env-file=.env.local -e "import('@supabase/supabase-js').then(async ({createClient})=>{const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY);const {data}=await s.storage.from('proposals').list('',{limit:100});console.log('top-level objects/prefixes:',data?.map(d=>d.name));})"
```
Expected: the deleted proposal's `<proposalId>` prefix is absent.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: Phase 1b finalize (build + tests green)"
```

---

## Done criteria (Phase 1b)

- An editor can create a proposal; v1 is auto-created and uploaded images become ordered pages.
- New versions upload and become current; restore is non-destructive (new version copies the old pages).
- visibility (private/public) and password set/change/remove all work.
- `/p/[publicId]` renders public proposals (minimal vertical render); private is blocked for non-editors; password proposals require unlock; the unlock cookie persists for its TTL.
- Images are exposed only via signed URLs; direct object access is impossible (private bucket).
- All data access goes through API routes/Server Components via Drizzle (no browser→Supabase data calls); the three new tables have RLS `FORCE` with no anon/authenticated policies.
- Unit tests cover the pure modules (constants, public-id, password, cookie, access).

**Next plan:** Phase 2 — Preview UX (1920 fixed fullscreen slide with hidden scrollbar + click-to-advance + keyboard + indicator; Figma-style canvas view; top toggle).
