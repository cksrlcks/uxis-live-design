import { cn } from "@/shared/lib/utils";
import { DataTableShell, dataBodyCell, dataHeadCell } from "@/shared/ui/data-table";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

// 라우트 진입(loading.tsx) 시 본문이 준비되기 전 잠깐 보여주는 스켈레톤 블록.
// 각 페이지의 isPending 스켈레톤과 톤을 맞춰, 로딩 → 클라이언트 마운트 전환이 끊김 없이 이어진다.
// 서버 컴포넌트로만 쓰이므로(인터랙션 없음) "use client" 없이 둔다.

/** 상단 액션 버튼(예: "새 시안") 자리. */
export function ActionSkeleton() {
  return <Skeleton className="rounded-control h-9 w-24" />;
}

/** 목록 상단 툴바 자리. widths에 Tailwind 폭 클래스를 넘긴 개수만큼 컨트롤을 그린다. */
export function ToolbarSkeleton({ widths = ["w-full max-w-xs"] }: { widths?: string[] }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {widths.map((w, i) => (
        <Skeleton key={i} className={cn("rounded-control h-10 shrink-0", w)} />
      ))}
    </div>
  );
}

/** 표 스켈레톤 — cols 열 × rows 행의 빈 셀. 실제 표와 열 수를 맞추면 전환 시 밀림이 없다. */
export function TableSkeleton({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <DataTableShell>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 border-border/60 border-b">
            {Array.from({ length: cols }).map((_, i) => (
              <TableHead key={i} className={dataHeadCell}>
                <Skeleton className="h-3.5 w-14" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow
              key={r}
              className="border-border/60 border-b last:border-0 hover:bg-transparent"
            >
              {Array.from({ length: cols }).map((_, c) => (
                <TableCell key={c} className={dataBodyCell}>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTableShell>
  );
}
