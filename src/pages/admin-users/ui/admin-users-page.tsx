"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { ProviderIcons, userQueries } from "@/entities/user";
import { UserRowActions } from "@/features/manage-users";
import { PageHeader, Toolbar } from "@/widgets/studio-shell";
import { cn } from "@/shared/lib/utils";
import { SearchInput } from "@/shared/ui/search-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { DataTableShell, DataTableState, dataHeadCell, dataBodyCell } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/skeleton";

const COL_COUNT = 5;

// BFF JSON으로 넘어온 날짜는 문자열 — Date로 감싸 안전하게 포맷한다.
function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function AdminUsersPage() {
  const { data: rows, isPending, isError } = useQuery(userQueries.list());
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));

  // 사용자 목록은 전량 조회 — 이름·이메일로 클라이언트에서 필터한다.
  const term = q.trim().toLowerCase();
  const filtered = term
    ? rows?.filter(
        (u) => u.name?.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
      )
    : rows;

  return (
    <div>
      <PageHeader title="사용자 관리" description="가입한 사용자를 조회하고 권한을 관리합니다." />

      <Toolbar
        trailing={
          filtered && filtered.length > 0 ? (
            <span className="text-caption text-muted-foreground">전체 {filtered.length}개</span>
          ) : undefined
        }
      >
        <SearchInput
          value={q}
          onChange={(next) => setQ(next || null)}
          placeholder="이름·이메일 검색"
          className="w-full max-w-xs"
        />
      </Toolbar>

      <DataTableShell>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-border/60 border-b">
              <TableHead className={dataHeadCell}>이름</TableHead>
              <TableHead className={dataHeadCell}>이메일</TableHead>
              <TableHead className={dataHeadCell}>가입수단</TableHead>
              <TableHead className={cn(dataHeadCell, "whitespace-nowrap")}>가입일</TableHead>
              <TableHead className={dataHeadCell}>권한</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow
                  key={`skeleton-${i}`}
                  className="border-border/60 border-b last:border-0 hover:bg-transparent"
                >
                  <TableCell className={dataBodyCell}>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <Skeleton className="h-4 w-44" />
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <Skeleton className="rounded-control h-8 w-28" />
                  </TableCell>
                </TableRow>
              ))}

            {isError && (
              <DataTableState colSpan={COL_COUNT}>
                <p className="text-body text-destructive">사용자 목록을 불러오지 못했습니다.</p>
              </DataTableState>
            )}

            {filtered?.length === 0 && (
              <DataTableState colSpan={COL_COUNT}>
                {q ? (
                  <p className="text-body text-muted-foreground">검색 결과가 없습니다.</p>
                ) : (
                  <EmptyState title="아직 사용자가 없습니다" />
                )}
              </DataTableState>
            )}

            {filtered?.map((u) => (
              <TableRow key={u.id} className="border-border/60 border-b last:border-0">
                <TableCell className={cn(dataBodyCell, "text-foreground font-medium")}>
                  {u.name ?? <span className="text-muted-foreground/50">—</span>}
                </TableCell>
                <TableCell className={dataBodyCell}>{u.email}</TableCell>
                <TableCell className={dataBodyCell}>
                  <ProviderIcons providers={u.providers} />
                </TableCell>
                <TableCell
                  className={cn(
                    dataBodyCell,
                    "text-muted-foreground whitespace-nowrap tabular-nums",
                  )}
                >
                  {formatDate(u.createdAt)}
                </TableCell>
                <TableCell className={dataBodyCell}>
                  <UserRowActions id={u.id} role={u.role} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableShell>
    </div>
  );
}
