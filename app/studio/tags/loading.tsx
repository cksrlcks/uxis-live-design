import { ActionSkeleton, PageHeader } from "@/widgets/studio-shell";
import { Skeleton } from "@/shared/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="태그 설정"
        description="시안에 태깅할 구분과 항목을 관리합니다."
        actions={<ActionSkeleton />}
      />
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="rounded-card h-40 w-full" />
        ))}
      </div>
    </div>
  );
}
