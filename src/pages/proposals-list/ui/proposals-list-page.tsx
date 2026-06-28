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
import { Tabs, TabsList, TabsTab } from "@/shared/ui/tabs";
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

// 목록 보기 모드: 표(리스트) ↔ 대표 이미지 카드(썸네일). URL ?view= 에 보존.
// 목록에 새로 진입하면 ?view 가 없어 항상 기본 리스트로 보인다. 썸네일에서 상세로
// 들어갈 때만 상세 URL에 ?view=thumb 를 실어 보내, 돌아올 때 그 뷰를 복원한다.
const VIEW_MODES = ["list", "thumb"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

// 활성 효과는 시안 상세 페이지의 좌측 네비(SectionNav)와 동일하게 —
// 트랙/그림자 없이 foreground 틴트 + 굵게.
const viewTabClass = cn(
  "text-foreground/80 hover:bg-foreground/5 h-10 gap-2 px-3.5 text-sm [&_svg]:size-4",
  "data-[active]:bg-foreground/10 data-[active]:text-foreground data-[active]:font-medium data-[active]:shadow-none",
);

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as ViewMode)}>
      <TabsList className="h-auto gap-1 bg-transparent p-0">
        <TabsTab value="list" className={viewTabClass}>
          <List aria-hidden />
          리스트
        </TabsTab>
        <TabsTab value="thumb" className={viewTabClass}>
          <LayoutGrid aria-hidden />
          썸네일
        </TabsTab>
      </TabsList>
    </Tabs>
  );
}

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

      <div className="mb-3 flex items-center gap-3">
        <ViewToggle value={view} onChange={(v) => setView(v)} />

        <div className="bg-border h-6 w-px shrink-0" aria-hidden />

        <SearchInput
          value={q}
          onChange={onSearch}
          placeholder="제목·참여자·도메인 검색"
          className="w-full max-w-xs"
        />

        <div className="flex items-center gap-1.5">
          {/* 연도 필터 */}
          <Select<number | null>
            value={yearFilter}
            onValueChange={(v) => onYearChange(v)}
          >
            <SelectTrigger size="lg" className="w-32 shadow-none">
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
          <Select<string | null>
            value={visFilter}
            onValueChange={(v) => onVisChange(v)}
          >
            <SelectTrigger size="lg" className="w-32 shadow-none">
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
        </div>

        {total > 0 && (
          <p className="text-muted-foreground ml-auto shrink-0 text-sm">전체 {total}개</p>
        )}
      </div>

      {view === "list" && (
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
              // 공개 도메인이 있으면 도메인으로, 없으면 publicId로 바로가기
              const shortcutPath = p.domain ? `/p/${p.domain}` : `/p/${p.publicId}`;
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
                      <Badge variant={isPublic ? "info" : "neutral"}>
                        {isPublic ? "공개" : "비공개"}
                      </Badge>
                      {hasPassword && <Badge variant="purple">비번</Badge>}
                      {p.exposedToUxisworks && <Badge variant="success">노출</Badge>}
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
      </div>
      )}

      {view === "thumb" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isPending &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={`thumb-skeleton-${i}`} className="bg-card flex flex-col gap-3 rounded-xl border p-3">
                <Skeleton className="aspect-16/10 w-full rounded-lg" />
                <div className="flex flex-col gap-2.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3.5 w-2/5" />
                </div>
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}

          {isError && (
            <div className="text-destructive col-span-full py-16 text-center">
              목록을 불러오지 못했습니다.
            </div>
          )}

          {rows?.length === 0 && (
            <div className="col-span-full py-16 text-center">
              {q || yearFilter || visFilter ? (
                <p className="text-muted-foreground text-sm">검색 결과가 없습니다.</p>
              ) : (
                <>
                  <p className="text-muted-foreground mb-4 text-sm">아직 시안이 없습니다.</p>
                  <NewProposalDialog />
                </>
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
                className="group bg-card hover:border-foreground/20 relative flex flex-col gap-3 rounded-xl border p-3 transition hover:shadow-md"
              >
                {/* 이미지 — 카드 안쪽 여백을 두고 둥근 모서리로 본문과 분리한다.
                    16:9 고정 박스에 가로를 꽉 채우고(object-cover) 위에서부터 보여줘
                    (object-top) 세로로 긴 시안도 카드마다 비율이 통일된다. */}
                {p.cover ? (
                  <div className="bg-muted border-border/60 aspect-16/10 overflow-hidden rounded-lg border">
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
                  <div className="bg-muted text-muted-foreground/50 border-border/60 flex aspect-16/10 items-center justify-center rounded-lg border text-xs">
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
                    <Badge variant={isPublic ? "info" : "neutral"} className="shrink-0">
                      {isPublic ? "공개" : "비공개"}
                    </Badge>
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
                      {hasPassword && <Badge variant="purple">비번</Badge>}
                      {p.exposedToUxisworks && <Badge variant="success">노출</Badge>}
                    </div>
                  )}
                </div>

                {/* 바로가기 — 카드 안쪽 버튼 형태. stretched link 위(z-10)에 올려 분리. */}
                <a
                  href={shortcutPath}
                  target="_blank"
                  rel="noreferrer"
                  className="border-input bg-background hover:bg-accent hover:text-accent-foreground relative z-10 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors"
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
