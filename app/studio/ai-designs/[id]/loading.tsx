import { Skeleton } from "@/shared/ui/skeleton";

// 제목이 동적(시안명)이라 헤더도 스켈레톤으로 둔다.
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Skeleton className="mb-4 h-4 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="rounded-card h-96 w-full" />
    </div>
  );
}
