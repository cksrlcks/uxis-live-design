"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { ArrowUpRight, Copy, MoreVertical, Pencil } from "lucide-react";
import { proposalQueries } from "@/entities/proposal";
import { PROPOSALS_PAGE_SIZE } from "@/entities/proposal/model/types";
import { NewProposalDialog } from "@/features/create-proposal";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/ui/pagination";
import { SearchInput } from "@/shared/ui/search-input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { PageHeader } from "@/widgets/studio-shell";

const headCell = "text-muted-foreground h-10 px-5 text-xs font-medium tracking-wide";
const bodyCell = "px-5 py-3.5 align-middle";
// 행 작업 드롭다운 — 기본 항목보다 여유 있게(패딩·간격) 보이도록 한다.
const menuItem = "gap-2.5 px-2.5 py-2";

// BFF JSON으로 넘어온 날짜는 문자열 — Date로 감싸 안전하게 포맷한다.
function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 공개 뷰어 경로(path)를 현재 origin과 합쳐 절대 URL로 클립보드에 복사한다.
async function copyViewerLink(path: string) {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    toast.success("시안 링크를 복사했습니다");
  } catch {
    toast.error("복사에 실패했습니다");
  }
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
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const { data, isPending, isError, isPlaceholderData } = useQuery(proposalQueries.list(page, q));

  // 검색어 변경 시 1페이지로 — 빈 값은 URL에서 q 파라미터를 제거(null)한다.
  function onSearch(next: string) {
    setQ(next || null);
    setPage(1);
  }

  const rows = data?.items;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PROPOSALS_PAGE_SIZE));

  return (
    <div>
      <PageHeader title="시안" actions={<NewProposalDialog />} />

      <div className="mb-3 flex items-center justify-between gap-3">
        <SearchInput
          value={q}
          onChange={onSearch}
          placeholder="제목·참여자·도메인 검색"
          className="w-full max-w-xs"
        />
        {total > 0 && (
          <p className="text-muted-foreground shrink-0 text-sm">전체 {total}개</p>
        )}
      </div>

      <div className="bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-border/60 border-b">
              <TableHead className={headCell}>제목</TableHead>
              <TableHead className={headCell}>참여자</TableHead>
              <TableHead className={headCell}>공개 ID</TableHead>
              <TableHead className={headCell}>공개 도메인</TableHead>
              <TableHead className={headCell}>상태</TableHead>
              <TableHead className={cn(headCell, "whitespace-nowrap")}>작성일</TableHead>
              <TableHead className={cn(headCell, "whitespace-nowrap")}>최근수정일</TableHead>
              <TableHead className={cn(headCell, "w-0")}>
                <span className="sr-only">작업</span>
              </TableHead>
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
                    <Skeleton className="h-3.5 w-24" />
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
                  <TableCell className={bodyCell}>
                    <Skeleton className="ml-auto size-7 rounded-full" />
                  </TableCell>
                </TableRow>
              ))}

            {isError && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="text-destructive px-5 py-16 text-center">
                  목록을 불러오지 못했습니다.
                </TableCell>
              </TableRow>
            )}

            {rows?.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="px-5 py-16 text-center">
                  {q ? (
                    <p className="text-muted-foreground text-sm">검색 결과가 없습니다.</p>
                  ) : (
                    <>
                      <p className="text-muted-foreground mb-4 text-sm">아직 시안이 없습니다.</p>
                      <NewProposalDialog />
                    </>
                  )}
                </TableCell>
              </TableRow>
            )}

            {rows?.map((p) => {
              const isPublic = p.visibility === "public";
              const hasPassword = isPublic && !!p.accessPasswordHash;
              // 시안 공개 링크 — 공개ID는 항상, 커스텀 도메인은 지정된 경우에만(최대 2개).
              const links = [
                { key: "id", label: "ID", name: "공개ID 링크", path: `/p/${p.publicId}` },
                ...(p.domain
                  ? [{ key: "domain", label: "도메인", name: "도메인 링크", path: `/p/${p.domain}` }]
                  : []),
              ];
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
                  <TableCell className={bodyCell}>
                    {p.participants ? (
                      <span className="text-foreground">{p.participants}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn(bodyCell, "text-muted-foreground font-mono")}>
                    {p.publicId}
                  </TableCell>
                  <TableCell className={cn(bodyCell, "font-mono")}>
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
                        <Badge variant="purple" size="md">
                          비번
                        </Badge>
                      )}
                      {p.exposedToUxisworks && (
                        <Badge variant="success" size="md">
                          노출
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
                  <TableCell className={bodyCell}>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label="작업 메뉴"
                          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors"
                        >
                          <MoreVertical className="size-4" aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 p-1.5">
                          <DropdownMenuItem
                            className={menuItem}
                            render={<Link href={`/studio/proposals/${p.id}`} />}
                          >
                            <Pencil />
                            수정하기
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {links.map((l) => (
                            <DropdownMenuItem
                              key={`copy-${l.key}`}
                              className={menuItem}
                              onClick={() => copyViewerLink(l.path)}
                            >
                              <Copy />
                              {l.name} 복사
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          {links.map((l) => (
                            <DropdownMenuItem
                              key={`open-${l.key}`}
                              className={menuItem}
                              render={<a href={l.path} target="_blank" rel="noreferrer" />}
                            >
                              <ArrowUpRight />
                              {l.name} 열기
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
