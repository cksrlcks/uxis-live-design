import { ProposalCreateForm } from "@/legacy/components/proposals/proposal-create-form";

export default function NewProposalPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">새 시안</h1>
      <p className="mt-2 text-sm text-muted-foreground">제목과 이미지를 올리면 v1이 자동 생성됩니다.</p>
      <div className="mt-6">
        <ProposalCreateForm />
      </div>
    </div>
  );
}
