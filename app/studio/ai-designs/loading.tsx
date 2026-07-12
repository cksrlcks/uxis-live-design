import { PageHeader, TableSkeleton, ToolbarSkeleton } from "@/widgets/studio-shell";
import { Card, CardContent } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeader title="AI 시안" description="Claude Code 스킬로 만든 HTML 시안 목록입니다." />
      {/* 상단 안내 배너 자리 — 실제 안내 Card와 같은 구조·여백으로 높이를 맞춘다. */}
      <Card size="sm" className="mb-4">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3.5 w-full max-w-md" />
              <Skeleton className="h-3.5 w-3/4 max-w-md" />
            </div>
          </div>
          <Skeleton className="rounded-control h-9 w-40 shrink-0" />
        </CardContent>
      </Card>
      <ToolbarSkeleton />
      <TableSkeleton cols={7} />
    </div>
  );
}
