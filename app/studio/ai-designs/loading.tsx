import { PageHeader, TableSkeleton, ToolbarSkeleton } from "@/widgets/studio-shell";
import { Skeleton } from "@/shared/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeader title="AI 시안" description="Claude Code 스킬로 만든 HTML 시안 목록입니다." />
      {/* 상단 안내 배너 자리 */}
      <Skeleton className="rounded-card mb-4 h-24 w-full" />
      <ToolbarSkeleton />
      <TableSkeleton cols={7} />
    </div>
  );
}
