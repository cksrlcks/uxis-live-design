import { PageHeader } from "@/widgets/studio-shell";
import { Skeleton } from "@/shared/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeader title="새 시안" description="제목과 이미지를 올리면 v1이 자동 생성됩니다." />
      <div className="max-w-2xl space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="rounded-control h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="rounded-card h-40 w-full" />
        </div>
        <Skeleton className="rounded-control h-10 w-28" />
      </div>
    </div>
  );
}
