import { ActionSkeleton, PageHeader, TableSkeleton, ToolbarSkeleton } from "@/widgets/studio-shell";

export default function Loading() {
  return (
    <div>
      <PageHeader title="시안" description="시안을 등록하고 관리합니다." actions={<ActionSkeleton />} />
      <ToolbarSkeleton widths={["w-40", "w-full max-w-xs", "w-32", "w-32"]} />
      <TableSkeleton cols={10} />
    </div>
  );
}
