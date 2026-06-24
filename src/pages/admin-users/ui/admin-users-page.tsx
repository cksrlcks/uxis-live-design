"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { ProviderBadges, userQueries } from "@/entities/user";
import { UserRowActions } from "@/features/manage-users";
import { PageHeader } from "@/widgets/studio-shell";
import { cn } from "@/shared/lib/utils";
import { SearchInput } from "@/shared/ui/search-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Skeleton } from "@/shared/ui/skeleton";

const headCell = "text-muted-foreground h-10 px-5 text-xs font-medium tracking-wide";
const bodyCell = "px-5 py-3.5 align-middle";

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
      <PageHeader title="사용자 관리" />

      <div className="mb-3 flex items-center justify-between gap-3">
        <SearchInput
          value={q}
          onChange={(next) => setQ(next || null)}
          placeholder="이름·이메일 검색"
          className="w-full max-w-xs"
        />
        {filtered && filtered.length > 0 && (
          <p className="text-muted-foreground shrink-0 text-sm">전체 {filtered.length}개</p>
        )}
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-border/60 border-b">
              <TableHead className={headCell}>이름</TableHead>
              <TableHead className={headCell}>이메일</TableHead>
              <TableHead className={headCell}>가입수단</TableHead>
              <TableHead className={headCell}>가입일</TableHead>
              <TableHead className={headCell}>작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow
                  key={`skeleton-${i}`}
                  className="border-border/60 border-b last:border-0 hover:bg-transparent"
                >
                  <TableCell className={bodyCell}>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Skeleton className="h-4 w-44" />
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Skeleton className="ml-auto size-7 rounded-md" />
                  </TableCell>
                </TableRow>
              ))}

            {isError && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="text-destructive px-5 py-16 text-center">
                  사용자 목록을 불러오지 못했습니다.
                </TableCell>
              </TableRow>
            )}

            {filtered?.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground px-5 py-16 text-center text-sm"
                >
                  {q ? "검색 결과가 없습니다." : "아직 사용자가 없습니다."}
                </TableCell>
              </TableRow>
            )}

            {filtered?.map((u) => (
              <TableRow key={u.id} className="border-border/60 border-b last:border-0">
                <TableCell className={cn(bodyCell, "font-medium")}>
                  {u.name ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className={bodyCell}>{u.email}</TableCell>
                <TableCell className={bodyCell}>
                  <ProviderBadges providers={u.providers} />
                </TableCell>
                <TableCell className={cn(bodyCell, "text-muted-foreground tabular-nums")}>
                  {formatDate(u.createdAt)}
                </TableCell>
                <TableCell className={bodyCell}>
                  <UserRowActions id={u.id} role={u.role} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
