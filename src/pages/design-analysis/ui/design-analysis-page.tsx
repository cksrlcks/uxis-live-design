"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader, StatBarSkeleton } from "@/widgets/studio-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { DataTableShell, DataTableState, dataHeadCell, dataBodyCell } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/skeleton";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import { analysisQueries } from "@/entities/design-analysis";
import type { AnalysisCoverage, AnalysisOverviewPage } from "@/entities/design-analysis";

const COL_COUNT = 6;

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function pct(analyzed: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((analyzed / total) * 100);
}

function CoverageStat({ label, analyzed, total }: { label: string; analyzed: number; total: number }) {
  const p = pct(analyzed, total);
  return (
    <div className="min-w-40">
      <div className="text-caption text-muted-foreground flex items-baseline justify-between gap-2">
        <span>{label}</span>
        <span>
          <span className="text-foreground font-medium">
            {analyzed}
          </span>
          {" / "}
          {total} · {p}%
        </span>
      </div>
      <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function latestAnalyzedAt(pages: AnalysisOverviewPage[]): string | null {
  let latest: string | null = null;
  for (const p of pages) {
    if (p.analyzedAt && (!latest || p.analyzedAt > latest)) latest = p.analyzedAt;
  }
  return latest;
}

function PageBlock({ page, showLabel, index }: { page: AnalysisOverviewPage; showLabel: boolean; index: number }) {
  return (
    <div className="space-y-3">
      {showLabel && (
        <div className="text-caption text-muted-foreground flex items-center gap-2">
          <Badge variant="neutral" className="shrink-0">
            페이지 {index + 1}
          </Badge>
          {page.industry && <span>{page.industry}</span>}
          {page.tone && <span className="truncate">· {page.tone}</span>}
        </div>
      )}
      {page.styleKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {page.styleKeywords.map((k, i) => (
            <Badge key={i} variant="neutral">
              {k}
            </Badge>
          ))}
        </div>
      )}
      {page.summary && <p className="text-body text-muted-foreground break-keep">{page.summary}</p>}
      {page.sections.length > 0 ? (
        <div className="divide-border/60 divide-y">
          {page.sections.map((s, i) => (
            <div key={i} className="flex gap-3 py-2 text-sm">
              <Badge variant="outline" className="shrink-0 self-start">
                {s.sectionType}
              </Badge>
              <div className="min-w-0">
                {s.layoutType && <span className="text-muted-foreground text-xs">{s.layoutType}</span>}
                <p className="break-keep">{s.promptSnippet ?? s.summary ?? "-"}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-caption text-muted-foreground">추출된 섹션이 없습니다.</p>
      )}
    </div>
  );
}

function CoverageBar({ coverage }: { coverage: AnalysisCoverage }) {
  return (
    <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
      <CoverageStat label="분석된 시안" analyzed={coverage.proposalsAnalyzed} total={coverage.proposalsTotal} />
      <CoverageStat label="분석된 페이지" analyzed={coverage.pagesAnalyzed} total={coverage.pagesTotal} />
    </div>
  );
}

export function DesignAnalysisPage() {
  const { data, isPending, isError } = useQuery(analysisQueries.overview());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const proposals = data?.proposals;

  return (
    <div>
      <PageHeader
        title="분석 데이터"
        description="cova-analyze-designs 스킬로 수집한 시안 분석(페이지·섹션 패턴)입니다."
      />

      {/* 로딩 중에도 커버리지 바 자리를 예약해(loading.tsx의 StatBarSkeleton과 동일)
          로딩 → 마운트 → 로드 사이에 표가 위아래로 밀리지 않게 한다. */}
      {isPending ? <StatBarSkeleton /> : data ? <CoverageBar coverage={data.coverage} /> : null}

      <DataTableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={cn(dataHeadCell, "w-8")} />
              <TableHead className={dataHeadCell}>시안</TableHead>
              <TableHead className={dataHeadCell}>업종</TableHead>
              <TableHead className={dataHeadCell}>톤</TableHead>
              <TableHead className={dataHeadCell}>섹션</TableHead>
              <TableHead className={dataHeadCell}>분석일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <DataTableState colSpan={COL_COUNT}>
                <Skeleton className="h-8 w-full" />
              </DataTableState>
            )}
            {isError && (
              <DataTableState colSpan={COL_COUNT}>
                <p className="text-body text-destructive">분석 데이터를 불러오지 못했습니다.</p>
              </DataTableState>
            )}
            {proposals?.length === 0 && (
              <DataTableState colSpan={COL_COUNT}>
                <EmptyState
                  title="분석 데이터가 없습니다"
                  description="cova-analyze-designs 스킬로 시안을 분석하면 여기에 표시됩니다."
                />
              </DataTableState>
            )}
            {proposals?.map((p) => {
              const open = expanded.has(p.proposalId);
              const first = p.pages[0];
              const sectionTotal = p.pages.reduce((sum, pg) => sum + pg.sections.length, 0);
              const multiPage = p.pages.length > 1;
              return (
                <Fragment key={p.proposalId}>
                  <TableRow
                    className="border-border/60 cursor-pointer border-b"
                    onClick={() => toggle(p.proposalId)}
                  >
                    <TableCell className={cn(dataBodyCell, "text-muted-foreground")}>
                      {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </TableCell>
                    <TableCell className={cn(dataBodyCell, "font-medium")}>
                      {p.proposalTitle}
                      {multiPage && (
                        <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                          · {p.pages.length}p
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={dataBodyCell}>{first?.industry ?? "-"}</TableCell>
                    <TableCell className={cn(dataBodyCell, "text-muted-foreground max-w-xs truncate")}>
                      {first?.tone ?? "-"}
                    </TableCell>
                    <TableCell className={dataBodyCell}>{sectionTotal}</TableCell>
                    <TableCell className={cn(dataBodyCell, "text-muted-foreground")}>
                      {formatDate(latestAnalyzedAt(p.pages))}
                    </TableCell>
                  </TableRow>
                  {open && (
                    <TableRow className="border-border/60 border-b">
                      <TableCell className="bg-muted/30 p-4" colSpan={COL_COUNT}>
                        <div className="space-y-5">
                          {p.pages.map((page, i) => (
                            <PageBlock key={page.id} page={page} showLabel={multiPage} index={i} />
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </DataTableShell>
    </div>
  );
}
