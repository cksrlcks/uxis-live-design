# Refactor Stage 3 — Admin User Management → FSD

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate admin user management (`/admin/users`) onto the new architecture: a guarded `entities/user` slice (read + role-update server fns + Zod), thin route handlers via `toErrorResponse`, a `features/manage-users` slice (role-change buttons + `useMutation`), and a client `src/pages/admin-users` page that fetches via `useQuery`. The admin permission gate stays server-side.

**Architecture:** Read flows client page `useQuery(userQueries.list())` → client fetcher (`@/shared/api/http`) → thin `GET /api/admin/users` → guarded `getUsers()` `*.server.ts` (`requireAdmin` + Drizzle) → `toErrorResponse`. Role change flows `UserRowActions` button → `useUpdateUserRole` → `PATCH /api/admin/users/[id]` → guarded `updateUserRole()` (`requireAdmin` + self-guard + Zod `parse` + DB) → invalidate `userQueries.list()`. The page-level admin redirect (`isAdmin` → `/dashboard`) stays a server component; the data fetch moves client-side.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), React 19, `@tanstack/react-query` v5, Zod v4, Drizzle, Vitest (node env).

**Source spec:** `docs/superpowers/specs/2026-06-17-fsd-react-query-refactor-design.md`. **Handoff:** `docs/superpowers/HANDOFF.md`. Builds on Stage 0/1/1b/2 (merged): `entities/proposal` (the slice pattern to mirror), `shared/api/{http,to-error-response}`, `shared/auth/{guards.server (requireAdmin), roles (ROLES)}`.

## Global Constraints

- **Node ≥22** (`package.json` engines; `next build` needs it). Already active on the dev machine (v22.18.0 via nvm) — do not switch Node.
- **FSD layer order:** `shared < entities < features < pages < app`. `entities`/`features` must **not** import `@/legacy`. Entity/feature barrels export only client-safe modules (never `*.server.ts`).
- **Security stays server-side:** `getUsers`/`updateUserRole` call `requireAdmin()` first; the page keeps its server-side `isAdmin` → `/dashboard` redirect (defence-in-depth on top of the API guard). The self-modification guard (`CANNOT_MODIFY_SELF`) is enforced in the server fn.
- **TDD (red-green) for PURE logic only:** the role Zod schema + the `CANNOT_MODIFY_SELF` status mapping. Integration code (server fns, route handlers, the client page/feature) has no unit tests in this repo's style — verify via `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, plus grep gates. State honestly per task.
- **One commit per task.** Prettier-format touched/new files before committing. `format:check` stays globally red on not-yet-migrated `src/legacy` + `app/`.
- **Green at every commit.** Tasks 2–3 thin the routes while the legacy code paths still work (the legacy RSC page reads the DB directly, not the GET; the legacy `user-row-actions` PATCH payload `{role}` is accepted by the Zod schema and the `204` satisfies its `res.ok` check).

### Documented behavior divergences (intended)

- `INVALID_ROLE` collapses to `VALIDATION_ERROR` (400) via the Zod enum. `CANNOT_MODIFY_SELF` (400) and `FORBIDDEN` (403) preserved.
- Role-update success becomes `204` (was `{ ok: true }`); the caller only checks `res.ok`.
- The admin users list is fetched client-side (brief loading state) instead of SSR; the page's non-admin redirect stays server-side.
- DTO is the rendered subset `{ id, email, role }` (the table shows email + role only); `displayName`/`approvedAt`/`approvedBy`/`createdAt` are not sent over the wire.
- Role-change **failures** now show a single generic "작업에 실패했습니다." instead of the legacy status-coded copy ("작업 실패 (400)" / "(403)") and "네트워크 오류". Server semantics are unchanged (`CANNOT_MODIFY_SELF` 400, `FORBIDDEN` 403, `VALIDATION_ERROR` 400) — only the client message is simplified (matches the inline-error pattern of the other migrated features).

---

### Task 1: `entities/user` foundation — DTO type + role Zod schema + `CANNOT_MODIFY_SELF` status (TDD)

**Files:**

- Create: `src/entities/user/model/types.ts`
- Create: `src/entities/user/model/role-schema.ts`
- Modify: `src/shared/api/to-error-response.ts`
- Test: `tests/entities/user/role-schema.test.ts`
- Test: `tests/shared/api/to-error-response.test.ts` (add `CANNOT_MODIFY_SELF`)

- [ ] **Step 1: DTO type** — `src/entities/user/model/types.ts`

```ts
import type { Role } from "@/shared/auth/roles";

// The admin users table renders email + role only.
export type AdminUser = {
  id: string;
  email: string;
  role: Role;
};
```

- [ ] **Step 2: Failing schema test** — `tests/entities/user/role-schema.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { updateRoleSchema } from "@/entities/user/model/role-schema";

describe("updateRoleSchema", () => {
  it("accepts the three valid roles", () => {
    expect(updateRoleSchema.safeParse({ role: "pending" }).success).toBe(true);
    expect(updateRoleSchema.safeParse({ role: "editor" }).success).toBe(true);
    expect(updateRoleSchema.safeParse({ role: "admin" }).success).toBe(true);
  });
  it("rejects an unknown role", () => {
    expect(updateRoleSchema.safeParse({ role: "superuser" }).success).toBe(false);
  });
  it("rejects a missing role", () => {
    expect(updateRoleSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run → FAIL** — `npm test -- tests/entities/user/role-schema.test.ts`.

- [ ] **Step 4: Implement the schema** — `src/entities/user/model/role-schema.ts`

```ts
import { z } from "zod";

export const updateRoleSchema = z.object({
  role: z.enum(["pending", "editor", "admin"]),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
```

- [ ] **Step 5: Run → PASS** — `npm test -- tests/entities/user/role-schema.test.ts`.

- [ ] **Step 6: Add `CANNOT_MODIFY_SELF` (TDD)** — append to `tests/shared/api/to-error-response.test.ts` (inside the `describe`):

```ts
it("maps CANNOT_MODIFY_SELF to 400", () => {
  expect(toErrorResponse(new Error("CANNOT_MODIFY_SELF")).status).toBe(400);
});
```

Run → FAIL, then add `CANNOT_MODIFY_SELF: 400,` to `STATUS_BY_CODE` in `src/shared/api/to-error-response.ts`, run → PASS.

- [ ] **Step 7: Format + commit**

```bash
npx prettier --write src/entities/user/model tests/entities/user/role-schema.test.ts src/shared/api/to-error-response.ts tests/shared/api/to-error-response.test.ts
git add -A
git commit -m "feat: entities/user DTO + role Zod schema + CANNOT_MODIFY_SELF status (Stage 3)"
```

---

### Task 2: `getUsers` read slice + thin `GET /api/admin/users`

**Files:**

- Create: `src/entities/user/api/get-users.server.ts`
- Create: `src/entities/user/api/get-users.ts`
- Create: `src/entities/user/api/user.query.ts`
- Create: `src/entities/user/index.ts`
- Modify: `app/api/admin/users/route.ts`

- [ ] **Step 1: Server fn** — `src/entities/user/api/get-users.server.ts`

```ts
import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/shared/db";
import { profiles } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import type { AdminUser } from "../model/types";
import type { Role } from "@/shared/auth/roles";

export async function getUsers(): Promise<AdminUser[]> {
  await requireAdmin();
  const rows = await db
    .select({ id: profiles.id, email: profiles.email, role: profiles.role })
    .from(profiles)
    .orderBy(desc(profiles.createdAt));
  return rows.map((r) => ({ id: r.id, email: r.email, role: r.role as Role }));
}
```

- [ ] **Step 2: Client fetcher** — `src/entities/user/api/get-users.ts`

```ts
import { http } from "@/shared/api/http";
import type { AdminUser } from "../model/types";

export function getUsers(): Promise<AdminUser[]> {
  return http<AdminUser[]>("/api/admin/users");
}
```

- [ ] **Step 3: Query factory** — `src/entities/user/api/user.query.ts`

```ts
import { queryOptions } from "@tanstack/react-query";
import { getUsers } from "./get-users";

export const userQueries = {
  all: () => ["users"] as const,
  lists: () => [...userQueries.all(), "list"] as const,
  list: () =>
    queryOptions({
      queryKey: userQueries.lists(),
      queryFn: getUsers,
    }),
};
```

- [ ] **Step 4: Barrel** — `src/entities/user/index.ts` (client-safe only; NO `*.server`)

```ts
export { userQueries } from "./api/user.query";
export { getUsers as fetchUsers } from "./api/get-users";
export type { AdminUser } from "./model/types";
```

- [ ] **Step 5: Thin the GET route** — replace `app/api/admin/users/route.ts` entirely:

```ts
import { getUsers } from "@/entities/user/api/get-users.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET() {
  try {
    return Response.json(await getUsers());
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 6: Typecheck + build** — `npx tsc --noEmit && npm run build` → PASS. (The legacy RSC page still reads the DB directly; the GET route is consumed by the client page in Task 5.)

- [ ] **Step 7: Format + commit**

```bash
npx prettier --write src/entities/user "app/api/admin/users/route.ts"
git add -A
git commit -m "feat: entities/user read slice (getUsers + userQueries) + thin GET /api/admin/users (Stage 3)"
```

---

### Task 3: `updateUserRole` server fn + thin `PATCH /api/admin/users/[id]`

**Files:**

- Create: `src/entities/user/api/update-user-role.server.ts`
- Modify: `app/api/admin/users/[id]/route.ts`

- [ ] **Step 1: Server fn** — `src/entities/user/api/update-user-role.server.ts`

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { profiles } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { ROLES } from "@/shared/auth/roles";
import { updateRoleSchema } from "../model/role-schema";

export async function updateUserRole(id: string, input: unknown): Promise<void> {
  const admin = await requireAdmin();
  if (id === admin.id) throw new Error("CANNOT_MODIFY_SELF");
  const { role } = updateRoleSchema.parse(input);

  await db
    .update(profiles)
    .set({
      role,
      approvedAt: role === ROLES.PENDING ? null : new Date(),
      approvedBy: role === ROLES.PENDING ? null : admin.id,
    })
    .where(eq(profiles.id, id));
}
```

> Behaviour preserved exactly: self-modification → `CANNOT_MODIFY_SELF` (400); invalid role → `ZodError` → `VALIDATION_ERROR` (400, was `INVALID_ROLE`); demote-to-pending clears `approvedAt`/`approvedBy`, promote sets them to now/admin.

- [ ] **Step 2: Thin the route** — replace `app/api/admin/users/[id]/route.ts` entirely:

```ts
import { NextRequest } from "next/server";
import { updateUserRole } from "@/entities/user/api/update-user-role.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await updateUserRole(id, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 3: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → PASS. The legacy `user-row-actions` still PATCHes `{role}` and checks `res.ok` — preserved (`204` is ok; valid roles accepted).

- [ ] **Step 4: Format + commit**

```bash
npx prettier --write src/entities/user/api/update-user-role.server.ts "app/api/admin/users/[id]/route.ts"
git add -A
git commit -m "refactor: updateUserRole guarded server fn + thin PATCH /api/admin/users/[id] (Stage 3)"
```

---

### Task 4: `features/manage-users` — fetcher + hook + `UserRowActions`

**Files:**

- Create: `src/features/manage-users/api/update-user-role.ts` (client fetcher)
- Create: `src/features/manage-users/api/use-update-user-role.ts` (hook)
- Create: `src/features/manage-users/ui/user-row-actions.tsx`
- Create: `src/features/manage-users/index.ts`

- [ ] **Step 1: Client fetcher** — `src/features/manage-users/api/update-user-role.ts`

```ts
import { http } from "@/shared/api/http";
import type { Role } from "@/shared/auth/roles";

export function updateUserRole(id: string, role: Role): Promise<void> {
  return http<void>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });
}
```

- [ ] **Step 2: Hook** — `src/features/manage-users/api/use-update-user-role.ts`

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userQueries } from "@/entities/user";
import type { Role } from "@/shared/auth/roles";
import { updateUserRole } from "./update-user-role";

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userQueries.lists() }),
  });
}
```

- [ ] **Step 3: UI** — `src/features/manage-users/ui/user-row-actions.tsx`

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import type { Role } from "@/shared/auth/roles";
import { useUpdateUserRole } from "../api/use-update-user-role";

export function UserRowActions({ id, role }: { id: string; role: Role }) {
  const updateRole = useUpdateUserRole();
  const [error, setError] = useState<string | null>(null);

  function setRole(next: Role) {
    setError(null);
    updateRole.mutate({ id, role: next }, { onError: () => setError("작업에 실패했습니다.") });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        {role === "pending" && (
          <Button size="sm" disabled={updateRole.isPending} onClick={() => setRole("editor")}>
            승인(편집자)
          </Button>
        )}
        {role !== "admin" && (
          <Button
            size="sm"
            variant="outline"
            disabled={updateRole.isPending}
            onClick={() => setRole("admin")}
          >
            관리자로
          </Button>
        )}
        {role !== "pending" && (
          <Button
            size="sm"
            variant="outline"
            disabled={updateRole.isPending}
            onClick={() => setRole("pending")}
          >
            권한 회수
          </Button>
        )}
      </div>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Barrel** — `src/features/manage-users/index.ts`

```ts
export { UserRowActions } from "./ui/user-row-actions";
```

- [ ] **Step 5: Typecheck + lint** — `npx tsc --noEmit && npm run lint` → PASS. (Not wired yet; verifies the slice compiles.)

- [ ] **Step 6: Format + commit**

```bash
npx prettier --write src/features/manage-users
git add -A
git commit -m "feat: features/manage-users (role-change actions + useUpdateUserRole) (Stage 3)"
```

---

### Task 5: Client `src/pages/admin-users` + flip the route (server admin gate) + delete legacy

**Files:**

- Create: `src/pages/admin-users/ui/admin-users-page.tsx`
- Create: `src/pages/admin-users/index.ts`
- Modify: `app/(dashboard)/admin/users/page.tsx` (server gate → renders the client page)
- Delete: `src/legacy/components/admin/user-row-actions.tsx`

- [ ] **Step 1: Client page** — `src/pages/admin-users/ui/admin-users-page.tsx`

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { userQueries } from "@/entities/user";
import { UserRowActions } from "@/features/manage-users";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";

export function AdminUsersPage() {
  const { data: rows, isPending, isError } = useQuery(userQueries.list());

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">사용자 관리</h1>
      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>이메일</TableHead>
            <TableHead>역할</TableHead>
            <TableHead className="text-right">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending && (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                불러오는 중…
              </TableCell>
            </TableRow>
          )}
          {isError && (
            <TableRow>
              <TableCell colSpan={3} className="text-destructive">
                사용자 목록을 불러오지 못했습니다.
              </TableCell>
            </TableRow>
          )}
          {rows?.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{u.role}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <UserRowActions id={u.id} role={u.role} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

`src/pages/admin-users/index.ts`:

```ts
export { AdminUsersPage } from "./ui/admin-users-page";
```

- [ ] **Step 2: Flip the route — keep the server admin gate** — replace `app/(dashboard)/admin/users/page.tsx` entirely:

```tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isAdmin, type Role } from "@/shared/auth/roles";
import { AdminUsersPage } from "@/pages/admin-users";

export default async function Page() {
  const profile = await getProfile();
  if (!profile || !isAdmin(profile.role as Role)) redirect("/dashboard");
  return <AdminUsersPage />;
}
```

> The route stays a server component for the `isAdmin` → `/dashboard` redirect (UX gate); the data fetch is now client-side via `AdminUsersPage`. The `GET /api/admin/users` `requireAdmin` guard is the security backstop. This is NOT an SSR data-fetch (only a profile read for gating, like `src/pages/home`).

- [ ] **Step 3: Delete the legacy component + verify no importer**

```bash
git rm src/legacy/components/admin/user-row-actions.tsx
# Scope to the LEGACY import path — a bare "user-row-actions" token would also match the
# new src/features/manage-users/ui/user-row-actions.tsx that legitimately owns that filename.
grep -rn "@/legacy/components/admin/user-row-actions\|legacy/components/admin/user-row-actions" app src   # expect NO output
```

- [ ] **Step 4: Typecheck + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → PASS.

- [ ] **Step 5: Manual smoke (if a session is available)** — `npm run dev`; as an admin open `/admin/users`: shows "불러오는 중…" then the list; 승인(편집자)/관리자로/권한 회수 update the row without a full reload (query invalidation); the self row cannot be modified (server returns `CANNOT_MODIFY_SELF` → inline "작업에 실패했습니다."). A non-admin visiting `/admin/users` is redirected to `/dashboard`. If no Supabase env, rely on tsc+lint+build and note it.

- [ ] **Step 6: Format + commit**

```bash
npx prettier --write src/pages/admin-users "app/(dashboard)/admin/users/page.tsx"
git add -A
git commit -m "feat: admin-users page client-side via useQuery + features/manage-users; drop legacy (Stage 3)"
```

---

### Task 6: Stage 3 verification gate + handoff update

**Files:** `docs/superpowers/HANDOFF.md` (the rest is verification only)

- [ ] **Step 1: Full green gate** — Node ≥22: `npx tsc --noEmit && npm run lint && npm test && npm run build` → all PASS. Report the test delta (+~4 role-schema + 1 CANNOT_MODIFY_SELF) and confirm the route table is unchanged in count (`/admin/users`, `/api/admin/users`, `/api/admin/users/[id]` all still present, now thin/client). Read actual counts from output.

- [ ] **Step 2: No-SSR / thin-route check**

```bash
grep -rn "@/shared/db\|@drizzle/schema" src/pages/admin-users   # expect empty (client page, no DB)
grep -rn "db\.\|drizzle" "app/api/admin/users/route.ts" "app/api/admin/users/[id]/route.ts"   # expect empty (thin routes)
```

Both expected empty. Confirm `app/(dashboard)/admin/users/page.tsx` only does the profile gate + renders the client page (no `db.select` of `profiles`).

- [ ] **Step 3: FSD layering + barrel safety**

```bash
grep -rn "@/legacy" src/entities/user src/features/manage-users src/pages/admin-users   # expect empty
grep -rn "\.server\"" src/entities/user/index.ts src/features/manage-users/index.ts     # expect empty
```

All expected empty.

- [ ] **Step 4: server-only safety** — no `"use client"` module reaches a server module:

```bash
grep -rln "use client" src/features/manage-users src/pages/admin-users | xargs grep -l "\.server\"\|@/shared/db\|@/shared/supabase/service" 2>/dev/null
```

Expected: NO output.

- [ ] **Step 5: legacy admin gone**

```bash
test ! -f src/legacy/components/admin/user-row-actions.tsx && echo "legacy user-row-actions deleted OK"
grep -rn "fetch(" src/pages/admin-users src/features/manage-users   # expect empty (writes via http/hook)
```

- [ ] **Step 6: Update the handoff** — in `docs/superpowers/HANDOFF.md`: add a Stage 3 "Done" entry (entities/user read slice + role Zod schema + guarded `getUsers`/`updateUserRole` + thin `GET`/`PATCH /api/admin/users`; `features/manage-users` replaces legacy `user-row-actions`; `src/pages/admin-users` client page; `CANNOT_MODIFY_SELF` 400 added; the page keeps its server-side `isAdmin` redirect). Update the test count. Set next = **Stage 4** (public viewer `/p/[publicId]` + relocation of the shared preview/pins components out of `src/legacy`). Commit:

```bash
npx prettier --write docs/superpowers/HANDOFF.md
git add docs/superpowers/HANDOFF.md
git commit -m "docs: handoff — Stage 3 done (admin users), next = Stage 4"
```

---

## Self-Review (completed by author)

- **Spec/handoff coverage:** admin users read moved client-side via `userQueries.list` + thin guarded `GET` (Tasks 2, 5); role-update via `features/manage-users` + thin guarded `PATCH` (Tasks 3–4); `entities/user` DTO + role schema (Task 1); the page keeps its server-side admin redirect (Task 5); verification + handoff (Task 6).
- **Green-at-every-commit:** Tasks 2–3 thin the routes while the legacy RSC page (DB-direct read) and legacy `user-row-actions` (PATCH `{role}` + `res.ok`) keep working (Zod accepts the roles; `204` is ok). Task 5 flips the page + deletes the legacy component atomically.
- **No-placeholder scan:** all code/commands concrete; new files complete; edits replace whole files.
- **Type consistency:** `AdminUser` (Task 1) consumed by `getUsers` server fn + client fetcher (Task 2) and the client page (Task 5); `UpdateRoleInput`/`updateRoleSchema` (Task 1) consumed by `updateUserRole` (Task 3); `Role` type threads through the fetcher/hook/UI (Task 4); `userQueries.list` (Task 2) consumed by the page (Task 5) + the hook's invalidation (Task 4); `CANNOT_MODIFY_SELF` (Task 1) thrown by `updateUserRole` (Task 3).
- **Known edges / accepted:** `INVALID_ROLE` → `VALIDATION_ERROR`; role-update → `204`; admin list fetched client-side (page redirect stays server-side); role-change failure copy simplified to a generic message (server status codes unchanged); no user-DELETE exists (none added). Runtime smoke deferred where no Supabase env.

**Adversarial audit (4 lenses: FSD-types / ordering-green / Next16-RQ / behavior-security; high+ findings independently refute-verified — 0 confirmed high/blocker):**

- Fixed (medium): Task 5's legacy-importer grep was scoped to a bare `user-row-actions` token, which would falsely match the NEW `features/manage-users/ui/user-row-actions.tsx` slice — re-scoped the gate to the `@/legacy/...` import path.
- Fixed (low): documented the role-change failure-copy simplification (legacy showed "작업 실패 (400/403)" / "네트워크 오류"; new shows a generic message) in the divergences list. Server semantics + the admin/self-modify guards are unchanged.

## Next: Stage 4 (public viewer)

Migrate the public viewer `/p/[publicId]` — and relocate the shared preview components (`proposal-preview`/`fullscreen-slides`/`canvas-view`) + pins out of `src/legacy` (deferred from Stage 2c), including the `requireViewerGate` access flow. Then Stage 5 realtime, Stage 6 cleanup + full permission audit + delete `src/legacy`.
