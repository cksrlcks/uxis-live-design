"use client";

import { useQuery } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { ProposalSettings } from "@/features/edit-proposal-settings";
import { VariantTabs } from "./variant-tabs";
import { ProposalEditorPreview } from "@/widgets/preview-canvas";

export function ProposalDetailPage({ proposalId }: { proposalId: string }) {
  const { data, isPending, isError } = useQuery(proposalQueries.detail(proposalId));

  if (isPending) return <p className="text-muted-foreground text-sm">불러오는 중…</p>;
  if (isError || !data)
    return <p className="text-destructive text-sm">시안을 불러오지 못했습니다.</p>;

  const { proposal, variants } = data;

  // Mirror the RSC page's `if (variants.length === 0) notFound()` guard: VariantTabs /
  // ProposalEditorPreview read `active.label` unconditionally and crash on an empty list.
  if (variants.length === 0) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{proposal.title}</h1>
        <p className="text-muted-foreground text-sm">표시할 안이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{proposal.title}</h1>
        <p className="text-muted-foreground mt-1 font-mono text-xs">/p/{proposal.publicId}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">설정</h2>
        <ProposalSettings
          proposalId={proposal.id}
          visibility={proposal.visibility}
          hasPassword={proposal.hasPassword}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">안</h2>
        <VariantTabs
          proposalId={proposal.id}
          variants={variants.map((v) => ({ id: v.id, label: v.label, slug: v.slug }))}
        />
      </section>

      <ProposalEditorPreview proposalId={proposal.id} variants={variants} />
    </div>
  );
}
