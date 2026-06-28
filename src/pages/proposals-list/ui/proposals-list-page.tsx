"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Copy,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Share2,
} from "lucide-react";
import { proposalQueries } from "@/entities/proposal";
import { PROPOSALS_PAGE_SIZE } from "@/entities/proposal/model/types";
import { NewProposalDialog } from "@/features/create-proposal";
import { cn } from "@/shared/lib/utils";
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
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { EmptyState } from "@/shared/ui/empty-state";
import { StatusPill } from "@/shared/ui/status-pill";
import {
  DataTableShell,
  DataTableState,
  dataHeadCell,
  dataBodyCell,
} from "@/shared/ui/data-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { PageHeader, Toolbar } from "@/widgets/studio-shell";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

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

// 목록 보기 모드: 표(리스트) ↔ 대표 이미지 카드(썸네일). URL ?view= 에 보존.
// 목록에 새로 진입하면 ?view 가 없어 항상 기본 리스트로 보인다. 썸네일에서 상세로
// 들어갈 때만 상세 URL에 ?view=thumb 를 실어 보내, 돌아올 때 그 뷰를 복원한다.
const VIEW_MODES = ["list", "thumb"] as const;

// nuqs parseAs helpers for filter params
const parseAsYear = parseAsInteger;
const parseAsVisibility = parseAsString;

export function ProposalsListPage() {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [yearFilter, setYearFilter] = useQueryState("year", parseAsYear);
  const [visFilter, setVisFilter] = useQueryState("visibility", parseAsVisibility);
  const [view, setView] = useQueryState(
    "view",
    parseAsStringLiteral(VIEW_MODES).withDefault("list"),
  );

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
      <PageHeader
        title="시안"
        description="시안을 등록하고 관리합니다."
        actions={<NewProposalDialog />}
      />

      <Toolbar
        trailing={
          total > 0 ? (
            <span className="text-caption text-muted-foreground">전체 {total}개</span>
          ) : undefined
        }
      >
        <SegmentedControl
          value={view}
          onValueChange={(v) => setView(v)}
          options={[
            { value: "list", label: "리스트", icon: List },
            { value: "thumb", label: "썸네일", icon: LayoutGrid },
          ]}
        />

        <div className="bg-border h-5 w-px shrink-0" aria-hidden />

        <SearchInput
          value={q}
          onChange={onSearch}
          placeholder="제목·참여자·도메인 검색"
          className="w-full max-w-xs"
        />

        {/* 연도 필터 */}
        <Select<number | null> value={yearFilter} onValueChange={(v) => onYearChange(v)}>
          <SelectTrigger size="default" className="w-32 shadow-none">
            <SelectValue>{(v) => (v == null ? "전체 연도" : `${v}년`)}</SelectValue>
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
        <Select<string | null> value={visFilter} onValueChange={(v) => onVisChange(v)}>
          <SelectTrigger size="default" className="w-32 shadow-none">
            <SelectValue>
              {(v) => (v === "public" ? "공개" : v === "private" ? "비공개" : "공개+비공개")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>공개+비공개</SelectItem>
            <SelectItem value="public">공개</SelectItem>
            <SelectItem value="private">비공개</SelectItem>
          </SelectContent>
        </Select>
      </Toolbar>

      {view === "list" && (
      <DataTableShell>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-border/60 border-b">
              <TableHead className={dataHeadCell}>제목</TableHead>
              <TableHead className={dataHeadCell}>참여자</TableHead>
              <TableHead className={cn(dataHeadCell, "whitespace-nowrap")}>연도</TableHead>
              <TableHead className={dataHeadCell}>공개 ID</TableHead>
              <TableHead className={dataHeadCell}>공개 도메인</TableHead>
              <TableHead className={dataHeadCell}>상태</TableHead>
              <TableHead className={dataHeadCell}>태깅</TableHead>
              <TableHead className={cn(dataHeadCell, "whitespace-nowrap")}>작성일</TableHead>
              <TableHead className={cn(dataHeadCell, "whitespace-nowrap")}>최근수정일</TableHead>
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
                  <TableCell className={dataBodyCell}><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className={dataBodyCell}><Skeleton className="h-3.5 w-24" /></TableCell>
                  <TableCell className={dataBodyCell}><Skeleton className="h-3.5 w-10" /></TableCell>
                  <TableCell className={dataBodyCell}><Skeleton className="h-3.5 w-16" /></TableCell>
                  <TableCell className={dataBodyCell}><Skeleton className="h-3.5 w-24" /></TableCell>
                  <TableCell className={dataBodyCell}><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
                  <TableCell className={dataBodyCell}><Skeleton className="size-6 rounded-full" /></TableCell>
                  <TableCell className={dataBodyCell}><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className={dataBodyCell}><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className={dataBodyCell}><Skeleton className="ml-auto size-7 rounded-full" /></TableCell>
                </TableRow>
              ))}

            {isError && (
              <DataTableState colSpan={COL_COUNT}>
                <p className="text-body text-destructive">목록을 불러오지 못했습니다.</p>
              </DataTableState>
            )}

            {rows?.length === 0 && (
              <DataTableState colSpan={COL_COUNT}>
                {q || yearFilter || visFilter ? (
                  <p className="text-body text-muted-foreground">검색 결과가 없습니다.</p>
                ) : (
                  <EmptyState title="아직 시안이 없습니다" action={<NewProposalDialog />} />
                )}
              </DataTableState>
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
              // 공개 도메인이 있으면 도메인으로, 없으면 publicId로 바로가기
              const shortcutPath = p.domain ? `/p/${p.domain}` : `/p/${p.publicId}`;
              return (
                <TableRow key={p.id} className="border-border/60 border-b last:border-0">
                  <TableCell className={dataBodyCell}>
                    <Link
                      href={`/studio/proposals/${p.id}`}
                      className="hover:text-primary font-medium underline underline-offset-4 transition-colors"
                    >
                      {p.title}
                    </Link>
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    {p.participants ? (
                      <span className="text-foreground">{p.participants}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn(dataBodyCell, "tabular-nums")}>
                    {p.workYear ? (
                      <span className="text-foreground">{p.workYear}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn(dataBodyCell, "text-muted-foreground font-mono")}>
                    {p.publicId}
                  </TableCell>
                  <TableCell className={cn(dataBodyCell, "font-mono")}>
                    {p.domain ? (
                      <span className="text-foreground">{p.domain}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill tone={isPublic ? "info" : "neutral"}>
                        {isPublic ? "공개" : "비공개"}
                      </StatusPill>
                      {hasPassword && <StatusPill tone="warning">비번</StatusPill>}
                      {p.exposedToUxisworks && <StatusPill tone="success">노출</StatusPill>}
                    </div>
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <ProgressRing value={p.taggingProgress} />
                  </TableCell>
                  <TableCell
                    className={cn(dataBodyCell, "text-muted-foreground whitespace-nowrap tabular-nums")}
                  >
                    {formatDate(p.createdAt)}
                  </TableCell>
                  <TableCell
                    className={cn(dataBodyCell, "text-muted-foreground whitespace-nowrap tabular-nums")}
                  >
                    {formatDate(p.updatedAt)}
                  </TableCell>
                  <TableCell className={dataBodyCell}>
                    <div className="flex items-center justify-end gap-0.5">
                      <a
                        href={shortcutPath}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="바로가기"
                        title="바로가기"
                        className="text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors"
                      >
                        <ArrowUpRight className="size-4" aria-hidden />
                      </a>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label="작업 메뉴"
                          className="text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors"
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
      </DataTableShell>
      )}

      {view === "thumb" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isPending &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={`thumb-skeleton-${i}`} className="bg-card flex flex-col gap-3 rounded-card border p-3">
                <Skeleton className="aspect-16/10 w-full rounded-card" />
                <div className="flex flex-col gap-2.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3.5 w-2/5" />
                </div>
                <Skeleton className="h-9 w-full rounded-control" />
              </div>
            ))}

          {isError && (
            <div className="text-body text-destructive col-span-full py-16 text-center">
              목록을 불러오지 못했습니다.
            </div>
          )}

          {rows?.length === 0 && (
            <div className="col-span-full">
              {q || yearFilter || visFilter ? (
                <p className="text-body text-muted-foreground py-16 text-center">검색 결과가 없습니다.</p>
              ) : (
                <EmptyState title="아직 시안이 없습니다" action={<NewProposalDialog />} />
              )}
            </div>
          )}

          {rows?.map((p) => {
            const isPublic = p.visibility === "public";
            const hasPassword = isPublic && !!p.accessPasswordHash;
            // 썸네일 → 상세 진입 시 ?view=thumb 를 실어 돌아올 때 썸네일 뷰를 복원한다.
            const detailHref = `/studio/proposals/${p.id}?view=thumb`;
            // 공개 도메인이 있으면 도메인으로, 없으면 publicId로 바로가기.
            const shortcutPath = p.domain ? `/p/${p.domain}` : `/p/${p.publicId}`;
            return (
              <div
                key={p.id}
                className="group bg-card hover:border-foreground/20 relative flex flex-col gap-3 rounded-card border p-3 transition hover:shadow-md"
              >
                {/* 이미지 — 카드 안쪽 여백을 두고 둥근 모서리로 본문과 분리한다.
                    16:9 고정 박스에 가로를 꽉 채우고(object-cover) 위에서부터 보여줘
                    (object-top) 세로로 긴 시안도 카드마다 비율이 통일된다. */}
                {p.cover ? (
                  <div className="bg-muted border-border/60 aspect-16/10 overflow-hidden rounded-card border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.cover.url}
                      alt={p.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                ) : (
                  <div className="bg-muted text-muted-foreground/50 border-border/60 flex aspect-16/10 items-center justify-center rounded-card border text-xs">
                    미리보기 없음
                  </div>
                )}

                <div className="flex flex-1 flex-col gap-1 px-1">
                  {/* 제목 + 공개 상태(같은 줄, 우측). 제목 링크의 ::after 를 카드 전체로
                      늘려(stretched link) 카드 어디를 눌러도 상세로 가게 하고,
                      바로가기 버튼만 z-10 으로 위에 둔다. */}
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={detailHref}
                      className="group-hover:text-primary line-clamp-2 font-semibold transition-colors after:absolute after:inset-0"
                    >
                      {p.title}
                    </Link>
                    <StatusPill tone={isPublic ? "info" : "neutral"}>
                      {isPublic ? "공개" : "비공개"}
                    </StatusPill>
                  </div>

                  {/* 리스트 칼럼: 참여자 / 연도 (가로 배치) */}
                  <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <dt className="text-muted-foreground shrink-0">참여자</dt>
                      <dd className="min-w-0 truncate font-medium">
                        {p.participants ?? <span className="text-muted-foreground/50">—</span>}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="text-muted-foreground shrink-0">연도</dt>
                      <dd className="tabular-nums font-medium">
                        {p.workYear ?? <span className="text-muted-foreground/50">—</span>}
                      </dd>
                    </div>
                  </dl>

                  {/* 부가 배지: 비번 · 노출 (있을 때만) */}
                  {(hasPassword || p.exposedToUxisworks) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {hasPassword && <StatusPill tone="warning">비번</StatusPill>}
                      {p.exposedToUxisworks && <StatusPill tone="success">노출</StatusPill>}
                    </div>
                  )}
                </div>

                {/* 바로가기 — 카드 안쪽 버튼 형태. stretched link 위(z-10)에 올려 분리. */}
                <a
                  href={shortcutPath}
                  target="_blank"
                  rel="noreferrer"
                  className="border-input bg-background hover:bg-accent hover:text-accent-foreground relative z-10 flex w-full items-center justify-center gap-1.5 rounded-control border py-2 text-xs font-medium transition-colors"
                >
                  <ArrowUpRight className="size-3.5" aria-hidden />
                  바로가기
                </a>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!shareTarget} onOpenChange={(open) => !open && setShareTarget(null)}>
        <DialogContent className="sm:max-w-md">
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
                    <span className="text-caption text-muted-foreground font-medium">{l.label} 링크</span>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={fullUrl}
                        className="bg-muted text-foreground border-input flex-1 rounded-control border px-3 py-1.5 font-mono text-xs outline-none"
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
                className="border-input bg-background hover:bg-accent hover:text-accent-foreground mt-2 flex w-full items-center justify-center gap-2 rounded-control border px-3 py-2 text-sm font-medium transition-colors"
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
