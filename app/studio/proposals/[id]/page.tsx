import { ProposalDetailPage } from "@/pages/proposal-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProposalDetailPage proposalId={id} />;
}
