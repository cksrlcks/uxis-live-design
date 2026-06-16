import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@/drizzle/schema";
import { createReadUrl } from "@/lib/proposals/storage";
import { ProposalPreview } from "@/components/preview/proposal-preview";
import { AddVersionForm } from "@/components/proposals/add-version-form";
import { RestoreButton } from "@/components/proposals/version-actions";
import { ProposalSettings } from "@/components/proposals/proposal-settings";
import { VariantTabs } from "@/components/proposals/variant-tabs";
import { Badge } from "@/components/ui/badge";

export default async function ProposalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const { id } = await params;
  const { variant: wantedVariantId } = await searchParams;

  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  const proposal = rows[0];
  if (!proposal) notFound();

  const variants = await db.select().from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id)).orderBy(asc(proposalVariants.sortOrder));
  if (variants.length === 0) notFound(); // 마이그레이션 후엔 항상 ≥1

  const active = variants.find((v) => v.id === wantedVariantId) ?? variants[0];

  const versions = await db.select().from(proposalVersions)
    .where(eq(proposalVersions.variantId, active.id)).orderBy(asc(proposalVersions.versionNo));

  const currentPages = active.currentVersionId
    ? await db.select().from(proposalPages)
        .where(eq(proposalPages.versionId, active.currentVersionId)).orderBy(asc(proposalPages.pageOrder))
    : [];
  const previews = await Promise.all(
    currentPages.map(async (pg) => ({
      id: pg.id, url: await createReadUrl(pg.storagePath), width: pg.width, height: pg.height,
    })),
  );

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
          variants={variants.map((v) => ({ id: v.id, label: v.label, slug: v.slug }))}
          activeVariantId={active.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">버전 히스토리 — {active.label}</h2>
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between rounded-[8px] border border-border px-4 py-2">
              <span className="text-sm">
                v{v.versionNo}{v.note ? ` — ${v.note}` : ""}
                {v.id === active.currentVersionId && <Badge className="ml-2" variant="outline">current</Badge>}
              </span>
              <RestoreButton proposalId={proposal.id} variantId={active.id} versionId={v.id} isCurrent={v.id === active.currentVersionId} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">새 버전 — {active.label}</h2>
        <AddVersionForm proposalId={proposal.id} variantId={active.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">현재 버전 미리보기 — {active.label}</h2>
        <div className="h-[80vh] overflow-hidden rounded-[8px] border border-border">
          <ProposalPreview pages={previews} />
        </div>
      </section>
    </div>
  );
}
