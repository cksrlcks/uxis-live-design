"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { ArrowUpRight, MoreVertical, Plus, RotateCw, Settings, Trash2 } from "lucide-react";
import { PageHeader, Toolbar } from "@/widgets/studio-shell";
import { Button } from "@/shared/ui/button";
import { useConfirm } from "@/shared/ui/confirm";
import { StatusPill } from "@/shared/ui/status-pill";
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
import { DataTableShell, DataTableState, dataHeadCell, dataBodyCell } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { cn } from "@/shared/lib/utils";
import {
  aiDesignQueries,
  AI_DESIGNS_PAGE_SIZE,
  AI_MODEL_OPTIONS,
  AiDesignStatusBadge,
  PAGE_TYPE_LABELS,
} from "@/entities/ai-design";
import {
  useDeleteAiDesign,
  useRetryAiDesign,
} from "@/entities/ai-design/api/use-ai-design-mutations";
import { CreateAiDesignModal } from "./create-ai-design-modal";

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
  const confirm = useConfirm();

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
              nativeButton={false}
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

      <Toolbar
        trailing={
          total > 0 ? (
            <span className="text-caption text-muted-foreground">전체 {total}개</span>
          ) : undefined
        }
      >
        <SearchInput
          value={q}
          onChange={onSearch}
          placeholder="제목·회사명·요청자 검색"
          className="w-full max-w-xs"
        />
      </Toolbar>

      <DataTableShell>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-border/60 border-b">
              <TableHead className={dataHeadCell}>제목</TableHead>
              <TableHead className={dataHeadCell}>유형</TableHead>
              <TableHead className={dataHeadCell}>모델</TableHead>
              <TableHead className={dataHeadCell}>요청자</TableHead>
              <TableHead className={dataHeadCell}>상태</TableHead>
              <TableHead className={cn(dataHeadCell, "whitespace-nowrap")}>작성일</TableHead>
              <TableHead className={cn(dataHeadCell, "w-0")}>
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
                  <TableCell className={dataBodyCell}>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <Skeleton className="h-3.5 w-28" />
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <Skeleton className="h-3.5 w-20" />
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <Skeleton className="ml-auto size-7 rounded-full" />
                  </TableCell>
                </TableRow>
              ))}

            {isError && (
              <DataTableState colSpan={COL_COUNT}>
                <p className="text-body text-destructive">목록을 불러오지 못했습니다.</p>
              </DataTableState>
            )}

            {rows?.length === 0 && (
              <DataTableState colSpan={COL_COUNT}>
                {total === 0 && !q ? (
                  <EmptyState
                    title="아직 생성한 시안이 없습니다"
                    description="‘생성하기’로 첫 AI 시안을 만들어 보세요."
                    action={
                      <Button type="button" onClick={() => setCreateOpen(true)}>
                        <Plus />
                        생성하기
                      </Button>
                    }
                  />
                ) : (
                  <p className="text-body text-muted-foreground">검색 결과가 없습니다.</p>
                )}
              </DataTableState>
            )}

            {rows?.map((d) => {
              const viewerHref = `/studio/ai-designs/${d.id}/raw`;
              const canOpen = d.status === "done" && d.hasHtml;
              return (
                <TableRow key={d.id} className="border-border/60 border-b last:border-0">
                  <TableCell className={dataBodyCell}>
                    <Link
                      href={`/studio/ai-designs/${d.id}`}
                      className="hover:text-primary font-medium underline underline-offset-4 transition-colors"
                    >
                      {d.title}
                    </Link>
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <StatusPill tone="neutral">
                      {PAGE_TYPE_LABELS[d.pageType] ?? d.pageType}
                    </StatusPill>
                  </TableCell>
                  <TableCell className={cn(dataBodyCell, "text-muted-foreground")}>
                    {d.model ? (
                      (MODEL_LABELS[d.model] ?? d.model)
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    {d.requestedBy ? (
                      <span className="text-foreground">{d.requestedBy}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <AiDesignStatusBadge status={d.status} errorMessage={d.errorMessage} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      dataBodyCell,
                      "text-muted-foreground whitespace-nowrap tabular-nums",
                    )}
                  >
                    {formatDate(d.createdAt)}
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <div className="flex items-center justify-end gap-0.5">
                      {canOpen && (
                        <a
                          href={viewerHref}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="바로가기"
                          title="바로가기"
                          className="text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors"
                        >
                          <ArrowUpRight className="size-4" aria-hidden />
                        </a>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label="작업 메뉴"
                          className="text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors"
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
                            onClick={async () => {
                              const ok = await confirm({
                                title: "이 시안을 삭제할까요?",
                                confirmLabel: "삭제",
                              });
                              if (!ok) return;
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
      </DataTableShell>

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
