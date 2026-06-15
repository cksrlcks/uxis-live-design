import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/drizzle/schema";
import { getProfile } from "@/lib/auth/session";
import { isAdmin, type Role } from "@/lib/auth/roles";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserRowActions } from "@/components/admin/user-row-actions";

export default async function AdminUsersPage() {
  const profile = await getProfile();
  if (!profile || !isAdmin(profile.role as Role)) redirect("/dashboard");

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
