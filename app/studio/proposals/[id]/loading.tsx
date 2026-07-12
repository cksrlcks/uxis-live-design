import { Skeleton } from "@/shared/ui/skeleton";

// 제목이 동적(시안명)이라 헤더도 스켈레톤으로 둔다.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <Skeleton className="mb-4 h-4 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-48">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="rounded-control h-9 w-full" />
            ))}
          </div>
        </aside>
        <div className="min-w-0 flex-1 space-y-4">
          <Skeleton className="rounded-card h-64 w-full" />
          <Skeleton className="rounded-card h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
