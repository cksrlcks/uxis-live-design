import { ProposalCreateForm } from "@/features/create-proposal";
import { PageHeader } from "@/widgets/studio-shell";

export function ProposalNewPage() {
  return (
    <div>
      <PageHeader title="새 시안" description="제목과 이미지를 올리면 v1이 자동 생성됩니다." />
      <ProposalCreateForm />
    </div>
  );
}
