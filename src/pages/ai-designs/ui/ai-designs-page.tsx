"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { ArrowUpRight, MoreVertical, Plus, RotateCw, Settings, Trash2 } from "lucide-react";
import { PageHeader } from "@/widgets/studio-shell";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { SearchInput } from "@/shared/ui/search-input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/lib/utils";
import {
  aiDesignQueries,
  AI_DESIGNS_PAGE_SIZE,
  AI_MODEL_OPTIONS,
  AiDesignStatusBadge,
  PAGE_TYPE_LABELS,
} from "@/entities/ai-design";
import { useDeleteAiDesign, useRetryAiDesign } from "@/entities/ai-design/api/use-ai-design-mutations";
import { CreateAiDesignModal } from "./create-ai-design-modal";

const headCell = "text-muted-foreground h-10 px-5 text-xs font-medium tracking-wide";
const bodyCell = "px-5 py-3.5 align-middle";
const menuItem = "gap-2.5 px-2.5 py-2";

const COL_COUNT = 7;

// 모델 value → 짧은 라벨. 화이트리스트에 없는 값(과거 행)은 원본 문자열을 그대로 표시.
const MODEL_LABELS: Record<string, string> = Object.fromEntries(
  AI_MODEL_OPTIONS.map((m) => [m.value, m.label]),
);

// BFF JSON으로 넘어온 날짜는 문자열 — Date로 감싸 안전하게 포맷한다.
function formatDate(value: string) {
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

export function AiDesignsPage() {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const { data, isPending, isError, isPlaceholderData } = useQuery(aiDesignQueries.list(page, q));
  const del = useDeleteAiDesign();
  const retry = useRetryAiDesign();
  const [createOpen, setCreateOpen] = useState(false);

  // 검색어 변경 시 1페이지로 — 빈 값은 URL에서 q 파라미터를 제거(null)한다.
  function onSearch(next: string) {
    setQ(next || null);
    setPage(1);
  }

  const rows = data?.items;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / AI_DESIGNS_PAGE_SIZE));

  // 마지막 페이지의 마지막 행을 삭제하면 page가 범위를 벗어나 빈 페이지에 갇힌다.
  // 실데이터(placeholder 아님) 기준으로 page를 유효 범위로 되돌린다.
  useEffect(() => {
    if (!isPlaceholderData && page > pageCount) setPage(pageCount);
  }, [isPlaceholderData, page, pageCount, setPage]);

  return (
    <div>
      <PageHeader
        title="AI 시안 생성"
        description="요구사항을 입력하면 AI가 참고 시안을 바탕으로 HTML 시안을 생성합니다."
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              render={<Link href="/studio/ai-designs/settings" aria-label="AI 생성 설정" />}
            >
              <Settings />
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus />
              생성하기
            </Button>
          </>
        }
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <SearchInput
          value={q}
          onChange={onSearch}
          placeholder="제목·회사명·요청자 검색"
          className="w-full max-w-xs"
        />
        {total > 0 && <p className="text-muted-foreground shrink-0 text-sm">전체 {total}개</p>}
      </div>

      <div className="bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-border/60 border-b">
              <TableHead className={headCell}>제목</TableHead>
              <TableHead className={headCell}>유형</TableHead>
              <TableHead className={headCell}>모델</TableHead>
              <TableHead className={headCell}>요청자</TableHead>
              <TableHead className={headCell}>상태</TableHead>
              <TableHead className={cn(headCell, "whitespace-nowrap")}>작성일</TableHead>
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
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Skeleton className="h-3.5 w-28" />
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Skeleton className="h-3.5 w-20" />
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Skeleton className="h-5 w-12 rounded-full" />
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
                <TableCell colSpan={COL_COUNT} className="text-destructive px-5 py-16 text-center">
                  목록을 불러오지 못했습니다.
                </TableCell>
              </TableRow>
            )}

            {rows?.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COL_COUNT} className="px-5 py-16 text-center">
                  {total === 0 && !q ? (
                    <>
                      <p className="text-muted-foreground mb-4 text-sm">
                        아직 생성한 시안이 없습니다. &apos;생성하기&apos;로 시작하세요.
                      </p>
                      <Button type="button" onClick={() => setCreateOpen(true)}>
                        <Plus />
                        생성하기
                      </Button>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">검색 결과가 없습니다.</p>
                  )}
                </TableCell>
              </TableRow>
            )}

            {rows?.map((d) => {
              const viewerHref = `/studio/ai-designs/${d.id}/raw`;
              const canOpen = d.status === "done" && d.hasHtml;
              return (
                <TableRow key={d.id} className="border-border/60 border-b last:border-0">
                  <TableCell className={bodyCell}>
                    <Link
                      href={`/studio/ai-designs/${d.id}`}
                      className="hover:text-primary font-medium underline underline-offset-4 transition-colors"
                    >
                      {d.title}
                    </Link>
                    {/* 회사명 표시 비활성화(필요 시 주석 해제하여 복구)
                    {d.company && (
                      <span className="text-muted-foreground ml-2 text-xs">{d.company}</span>
                    )}
                    */}
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <Badge variant="outline">{PAGE_TYPE_LABELS[d.pageType] ?? d.pageType}</Badge>
                  </TableCell>
                  <TableCell className={cn(bodyCell, "text-muted-foreground text-sm")}>
                    {d.model ? (MODEL_LABELS[d.model] ?? d.model) : <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell className={cn(bodyCell, "text-sm")}>
                    {d.requestedBy ? (
                      <span className="text-foreground">{d.requestedBy}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <AiDesignStatusBadge status={d.status} errorMessage={d.errorMessage} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      bodyCell,
                      "text-muted-foreground text-sm whitespace-nowrap tabular-nums",
                    )}
                  >
                    {formatDate(d.createdAt)}
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
                          {canOpen && (
                            <DropdownMenuItem
                              className={menuItem}
                              render={<a href={viewerHref} target="_blank" rel="noreferrer" />}
                            >
                              <ArrowUpRight />
                              뷰어 열기
                            </DropdownMenuItem>
                          )}
                          {d.status === "failed" && (
                            <DropdownMenuItem
                              className={menuItem}
                              disabled={retry.isPending}
                              onClick={() =>
                                retry.mutate(d.id, {
                                  onSuccess: () => toast.success("다시 생성을 시작했습니다"),
                                  onError: () => toast.error("재시도에 실패했습니다"),
                                })
                              }
                            >
                              <RotateCw />
                              재시도
                            </DropdownMenuItem>
                          )}
                          {canOpen || d.status === "failed" ? <DropdownMenuSeparator /> : null}
                          <DropdownMenuItem
                            variant="destructive"
                            className={menuItem}
                            disabled={del.isPending}
                            onClick={() => {
                              if (!confirm("이 시안을 삭제할까요?")) return;
                              del.mutate(d.id, {
                                onSuccess: () => toast.success("삭제했습니다"),
                                onError: () => toast.error("삭제에 실패했습니다"),
                              });
                            }}
                          >
                            <Trash2 />
                            삭제
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

      <CreateAiDesignModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
