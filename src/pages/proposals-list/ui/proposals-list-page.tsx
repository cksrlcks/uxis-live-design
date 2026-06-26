"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { ArrowUpRight, Copy, MoreVertical, Pencil, Share2 } from "lucide-react";
import { proposalQueries } from "@/entities/proposal";
import { PROPOSALS_PAGE_SIZE } from "@/entities/proposal/model/types";
import { NewProposalDialog } from "@/features/create-proposal";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { ProgressRing } from "@/shared/ui/progress-ring";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { SearchInput } from "@/shared/ui/search-input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { PageHeader } from "@/widgets/studio-shell";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

const headCell = "text-muted-foreground h-10 px-5 text-xs font-medium tracking-wide";
const bodyCell = "px-5 py-3.5 align-middle";
const menuItem = "gap-2.5 px-2.5 py-2";

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

async function copyViewerLink(path: string) {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    toast.success("시안 링크를 복사했습니다");
  } catch {
    toast.error("복사에 실패했습니다");
  }
}

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

type ShareTarget = {
  title: string;
  links: { key: string; label: string; path: string }[];
};

// nuqs parseAs helpers for filter params
const parseAsYear = parseAsInteger;
const parseAsVisibility = parseAsString;

export function ProposalsListPage() {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [yearFilter, setYearFilter] = useQueryState("year", parseAsYear);
  const [visFilter, setVisFilter] = useQueryState("visibility", parseAsVisibility);

  const year = yearFilter ?? undefined;
  const visibility =
    visFilter === "public" || visFilter === "private" ? visFilter : undefined;

  const { data, isPending, isError, isPlaceholderData } = useQuery(
    proposalQueries.list(page, q, year, visibility),
  );
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);

  function onSearch(next: string) {
    setQ(next || null);
    setPage(1);
  }

  function onYearChange(v: number | null) {
    setYearFilter(v);
    setPage(1);
  }

  function onVisChange(v: string | null) {
    setVisFilter(v);
    setPage(1);
  }

  const rows = data?.items;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PROPOSALS_PAGE_SIZE));
  // 테이블 colspan: 기존 9 → 연도 칼럼 추가로 10
  const COL_COUNT = 10;

  return (
    <div>
      <PageHeader title="시안" actions={<NewProposalDialog />} />

      <div className="mb-3 flex items-center gap-3">
        <SearchInput
          value={q}
          onChange={onSearch}
          placeholder="제목·참여자·도메인 검색"
          className="w-full max-w-xs"
        />

        {/* 연도 필터 */}
        <Select<number | null>
          value={yearFilter}
          onValueChange={(v) => onYearChange(v)}
        >
          <SelectTrigger size="lg" className="w-32 shadow-none">
            <SelectValue placeholder="전체 연도" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>전체 연도</SelectItem>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 공개상태 필터 */}
        <Select<string | null>
          value={visFilter}
          onValueChange={(v) => onVisChange(v)}
        >
          <SelectTrigger size="lg" className="w-28 shadow-none">
            <SelectValue placeholder="전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>전체</SelectItem>
            <SelectItem value="public">공개</SelectItem>
            <SelectItem value="private">비공개</SelectItem>
          </SelectContent>
        </Select>

        {total > 0 && (
          <p className="text-muted-foreground ml-auto shrink-0 text-sm">전체 {total}개</p>
        )}
      </div>

      <div className="bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-border/60 border-b">
              <TableHead className={headCell}>제목</TableHead>
              <TableHead className={headCell}>참여자</TableHead>
              <TableHead className={cn(headCell, "whitespace-nowrap")}>연도</TableHead>
              <TableHead className={headCell}>공개 ID</TableHead>
              <TableHead className={headCell}>공개 도메인</TableHead>
              <TableHead className={headCell}>상태</TableHead>
              <TableHead className={headCell}>태깅</TableHead>
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
                  <TableCell className={bodyCell}><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-3.5 w-24" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-3.5 w-10" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-3.5 w-16" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-3.5 w-24" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="size-6 rounded-full" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="ml-auto size-7 rounded-full" /></TableCell>
                </TableRow>
              ))}

            {isError && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COL_COUNT} className="text-destructive px-5 py-16 text-center">
                  목록을 불러오지 못했습니다.
                </TableCell>
              </TableRow>
            )}

            {rows?.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COL_COUNT} className="px-5 py-16 text-center">
                  {q || yearFilter || visFilter ? (
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
                  <TableCell className={cn(bodyCell, "tabular-nums")}>
                    {p.workYear ? (
                      <span className="text-foreground">{p.workYear}</span>
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
                        <Badge variant="purple" size="md">비번</Badge>
                      )}
                      {p.exposedToUxisworks && (
                        <Badge variant="success" size="md">노출</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <ProgressRing value={p.taggingProgress} />
                  </TableCell>
                  <TableCell
                    className={cn(bodyCell, "text-muted-foreground text-sm whitespace-nowrap tabular-nums")}
                  >
                    {formatDate(p.createdAt)}
                  </TableCell>
                  <TableCell
                    className={cn(bodyCell, "text-muted-foreground text-sm whitespace-nowrap tabular-nums")}
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
                        <DropdownMenuContent align="end" className="w-44 p-1.5">
                          <DropdownMenuItem
                            className={menuItem}
                            render={<Link href={`/studio/proposals/${p.id}`} />}
                          >
                            <Pencil />
                            수정하기
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className={menuItem}
                            onClick={() =>
                              setShareTarget({
                                title: p.title,
                                links: links.map((l) => ({
                                  key: l.key,
                                  label: l.label,
                                  path: l.path,
                                })),
                              })
                            }
                          >
                            <Share2 />
                            공유하기
                          </DropdownMenuItem>
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

      <Dialog open={!!shareTarget} onOpenChange={(open) => !open && setShareTarget(null)}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader className="mb-1">
            <DialogTitle>시안 공유</DialogTitle>
            {shareTarget && (
              <DialogDescription className="truncate">{shareTarget.title}</DialogDescription>
            )}
          </DialogHeader>
          {shareTarget && (
            <div className="flex flex-col gap-4">
              {shareTarget.links.map((l) => {
                const fullUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${l.path}`;
                return (
                  <div key={l.key} className="flex flex-col gap-2">
                    <span className="text-muted-foreground text-xs font-medium">{l.label} 링크</span>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={fullUrl}
                        className="bg-muted text-foreground border-input flex-1 rounded-md border px-3 py-1.5 font-mono text-xs outline-none"
                        onFocus={(e) => e.target.select()}
                      />
                      <Button
                        size="icon-sm"
                        variant="outline"
                        aria-label="링크 복사"
                        onClick={() => copyViewerLink(l.path)}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <a
                href={(shareTarget.links.find((l) => l.key === "domain") ?? shareTarget.links[0]).path}
                target="_blank"
                rel="noreferrer"
                className="border-input bg-background hover:bg-accent hover:text-accent-foreground mt-2 flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
              >
                <ArrowUpRight className="size-4" />
                바로가기
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
