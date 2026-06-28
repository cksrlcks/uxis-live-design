import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { TableCell, TableRow } from "@/shared/ui/table";

/** 테이블을 감싸는 카드 표면(흰 면 + 헤어라인 + 8px). */
export function DataTableShell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("bg-card overflow-hidden rounded-card border", className)}>{children}</div>
  );
}

/** 표준 헤더/본문 셀 클래스 — 페이지별 headCell/bodyCell 중복을 대체. */
export const dataHeadCell = "text-muted-foreground h-9 px-4 text-caption font-medium";
export const dataBodyCell = "px-4 py-2.5 align-middle text-body";

/** 로딩/빈/에러용 전열 상태 행. */
export function DataTableState({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="px-4 py-16 text-center">
        {children}
      </TableCell>
    </TableRow>
  );
}
