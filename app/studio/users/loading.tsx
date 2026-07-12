import { PageHeader, TableSkeleton, ToolbarSkeleton } from "@/widgets/studio-shell";

export default function Loading() {
  return (
    <div>
      <PageHeader title="사용자 관리" description="가입한 사용자를 조회하고 권한을 관리합니다." />
      <ToolbarSkeleton />
      <TableSkeleton cols={6} />
    </div>
  );
}
