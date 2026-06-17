import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals } from "@/drizzle/schema";
import { loadEditorVariants } from "@/lib/preview/load-variants";
import { ProposalSettings } from "@/components/proposals/proposal-settings";
import { VariantTabs } from "@/components/proposals/variant-tabs";
import { ProposalEditorPreview } from "@/components/preview/proposal-editor-preview";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  const proposal = rows[0];
  if (!proposal) notFound();

  // Every 안 with its versions + current pages, signed in one batch. The active
  // 안 (?variant) is resolved client-side so switching tabs is instant.
  const variants = await loadEditorVariants(proposal.id);
  if (variants.length === 0) notFound(); // 마이그레이션 후엔 항상 ≥1

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{proposal.title}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">/p/{proposal.publicId}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">설정</h2>
        <ProposalSettings proposalId={proposal.id} visibility={proposal.visibility} hasPassword={!!proposal.accessPasswordHash} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">안</h2>
        <VariantTabs proposalId={proposal.id}
          variants={variants.map((v) => ({ id: v.id, label: v.label, slug: v.slug }))} />
      </section>

      <ProposalEditorPreview proposalId={proposal.id} variants={variants} />
    </div>
  );
}
