"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/widgets/studio-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { DataTableShell, DataTableState, dataHeadCell, dataBodyCell } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/skeleton";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import { analysisQueries } from "@/entities/design-analysis";

const COL_COUNT = 6;

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function DesignAnalysisPage() {
  const { data: rows, isPending, isError } = useQuery(analysisQueries.overview());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="분석 데이터"
        description="cova-analyze-designs 스킬로 수집한 시안 분석(페이지·섹션 패턴)입니다."
      />

      {rows && rows.length > 0 && (
        <p className="text-caption text-muted-foreground mb-3">전체 {rows.length}개</p>
      )}

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
            {rows?.length === 0 && (
              <DataTableState colSpan={COL_COUNT}>
                <EmptyState
                  title="분석 데이터가 없습니다"
                  description="cova-analyze-designs 스킬로 시안을 분석하면 여기에 표시됩니다."
                />
              </DataTableState>
            )}
            {rows?.map((p) => {
              const open = expanded.has(p.id);
              return (
                <Fragment key={p.id}>
                  <TableRow
                    className="border-border/60 cursor-pointer border-b"
                    onClick={() => toggle(p.id)}
                  >
                    <TableCell className={cn(dataBodyCell, "text-muted-foreground")}>
                      {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </TableCell>
                    <TableCell className={cn(dataBodyCell, "font-medium")}>{p.proposalTitle}</TableCell>
                    <TableCell className={dataBodyCell}>{p.industry ?? "-"}</TableCell>
                    <TableCell className={cn(dataBodyCell, "text-muted-foreground max-w-xs truncate")}>
                      {p.tone ?? "-"}
                    </TableCell>
                    <TableCell className={dataBodyCell}>{p.sections.length}</TableCell>
                    <TableCell className={cn(dataBodyCell, "text-muted-foreground")}>
                      {formatDate(p.analyzedAt)}
                    </TableCell>
                  </TableRow>
                  {open && (
                    <TableRow className="border-border/60 border-b">
                      <TableCell className="bg-muted/30 p-4" colSpan={COL_COUNT}>
                        <div className="space-y-3">
                          {p.styleKeywords.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {p.styleKeywords.map((k, i) => (
                                <Badge key={i} variant="neutral">
                                  {k}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {p.summary && (
                            <p className="text-body text-muted-foreground break-keep">{p.summary}</p>
                          )}
                          {p.sections.length > 0 ? (
                            <div className="divide-border/60 divide-y">
                              {p.sections.map((s, i) => (
                                <div key={i} className="flex gap-3 py-2 text-sm">
                                  <Badge variant="outline" className="shrink-0 self-start">
                                    {s.sectionType}
                                  </Badge>
                                  <div className="min-w-0">
                                    {s.layoutType && (
                                      <span className="text-muted-foreground text-xs">{s.layoutType}</span>
                                    )}
                                    <p className="break-keep">{s.promptSnippet ?? s.summary ?? "-"}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-caption text-muted-foreground">추출된 섹션이 없습니다.</p>
                          )}
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
