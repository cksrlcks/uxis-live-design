import { TableSkeleton, ToolbarSkeleton } from "@/widgets/studio-shell";
import { Skeleton } from "@/shared/ui/skeleton";

// 스튜디오 하위 라우트 공용 폴백 — 자체 loading.tsx가 없는 세그먼트에 쓰인다.
export default function Loading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <ToolbarSkeleton />
      <TableSkeleton cols={6} />
    </div>
  );
}
