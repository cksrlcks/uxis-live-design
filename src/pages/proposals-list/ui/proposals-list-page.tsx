"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { parseAsInteger, useQueryState } from "nuqs";
import { ArrowUpRight } from "lucide-react";
import { proposalQueries } from "@/entities/proposal";
import { PROPOSALS_PAGE_SIZE } from "@/entities/proposal/model/types";
import { NewProposalDialog } from "@/features/create-proposal";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/ui/pagination";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { PageHeader } from "@/widgets/studio-shell";

const headCell = "text-muted-foreground h-10 px-5 text-xs font-medium tracking-wide";
const bodyCell = "px-5 py-3.5 align-middle";

// BFF JSON으로 넘어온 날짜는 문자열 — Date로 감싸 안전하게 포맷한다.
function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 번호 페이지네이션 항목 — 1, 2, …, current-1, current, current+1, …, last.
function pageItems(current: number, count: number): (number | "ellipsis")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(count - 1, current + 1);
  if (start > 2) items.push("ellipsis");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < count - 1) items.push("ellipsis");
  items.push(count);
  return items;
}

export function ProposalsListPage() {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const { data, isPending, isError, isPlaceholderData } = useQuery(proposalQueries.list(page));

  const rows = data?.items;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PROPOSALS_PAGE_SIZE));

  return (
    <div>
      <PageHeader title="시안" actions={<NewProposalDialog />} />

      {total > 0 && <p className="text-muted-foreground mb-3 text-sm">전체 {total}개</p>}

      <div className="bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 border-b hover:bg-transparent">
              <TableHead className={headCell}>제목</TableHead>
              <TableHead className={headCell}>공개 ID</TableHead>
              <TableHead className={headCell}>공개 도메인</TableHead>
              <TableHead className={headCell}>상태</TableHead>
              <TableHead className={cn(headCell, "whitespace-nowrap")}>작성일</TableHead>
              <TableHead className={cn(headCell, "whitespace-nowrap")}>최근수정일</TableHead>
              <TableHead className={cn(headCell, "text-right")}>링크</TableHead>
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
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Skeleton className="h-3.5 w-16" />
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Skeleton className="h-3.5 w-24" />
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className={cn(bodyCell, "text-right")}>
                    <Skeleton className="ml-auto h-4 w-16" />
                  </TableCell>
                </TableRow>
              ))}

            {isError && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="text-destructive px-5 py-16 text-center">
                  목록을 불러오지 못했습니다.
                </TableCell>
              </TableRow>
            )}

            {rows?.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="px-5 py-16 text-center">
                  <p className="text-muted-foreground mb-4 text-sm">아직 시안이 없습니다.</p>
                  <NewProposalDialog />
                </TableCell>
              </TableRow>
            )}

            {rows?.map((p) => {
              const isPublic = p.visibility === "public";
              const hasPassword = isPublic && !!p.accessPasswordHash;
              return (
                <TableRow key={p.id} className="border-border/60 border-b last:border-0">
                  <TableCell className={bodyCell}>
                    <Link
                      href={`/studio/proposals/${p.id}`}
                      className="hover:text-primary font-medium underline underline-offset-4 transition-colors"
                    >
                      {p.title}
                    </Link>
                  </TableCell>
                  <TableCell className={cn(bodyCell, "text-muted-foreground font-mono text-xs")}>
                    {p.publicId}
                  </TableCell>
                  <TableCell className={cn(bodyCell, "font-mono text-xs")}>
                    {p.domain ? (
                      <span className="text-foreground">{p.domain}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={isPublic ? "info" : "neutral"} size="md">
                        {isPublic ? "공개" : "비공개"}
                      </Badge>
                      {hasPassword && (
                        <Badge variant="warning" size="md">
                          비번
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    className={cn(
                      bodyCell,
                      "text-muted-foreground text-sm whitespace-nowrap tabular-nums",
                    )}
                  >
                    {formatDate(p.createdAt)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      bodyCell,
                      "text-muted-foreground text-sm whitespace-nowrap tabular-nums",
                    )}
                  >
                    {formatDate(p.updatedAt)}
                  </TableCell>
                  <TableCell className={cn(bodyCell, "text-right")}>
                    <Link
                      href={`/p/${p.publicId}`}
                      target="_blank"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
                    >
                      뷰어 열기
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  disabled={page <= 1 || isPlaceholderData}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                />
              </PaginationItem>

              {pageItems(page, pageCount).map((item, i) =>
                item === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationLink
                      isActive={item === page}
                      disabled={isPlaceholderData}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  disabled={page >= pageCount || isPlaceholderData}
                  onClick={() => setPage((p) => p + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
