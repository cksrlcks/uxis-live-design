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
