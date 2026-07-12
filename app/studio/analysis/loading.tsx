import { PageHeader, TableSkeleton } from "@/widgets/studio-shell";

export default function Loading() {
  return (
    <div>
      <PageHeader
        title="분석 데이터"
        description="cova-analyze-designs 스킬로 수집한 시안 분석(페이지·섹션 패턴)입니다."
      />
      <TableSkeleton cols={6} />
    </div>
  );
}
