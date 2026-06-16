import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVersions, proposalPages } from "@/drizzle/schema";
import { createReadUrl } from "@/lib/proposals/storage";
import { AddVersionForm } from "@/components/proposals/add-version-form";
import { RestoreButton } from "@/components/proposals/version-actions";
import { ProposalSettings } from "@/components/proposals/proposal-settings";
import { Badge } from "@/components/ui/badge";

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  const proposal = rows[0];
  if (!proposal) notFound();

  const versions = await db.select().from(proposalVersions)
    .where(eq(proposalVersions.proposalId, id)).orderBy(asc(proposalVersions.versionNo));

  const currentPages = proposal.currentVersionId
    ? await db.select().from(proposalPages)
        .where(eq(proposalPages.versionId, proposal.currentVersionId)).orderBy(asc(proposalPages.pageOrder))
    : [];
  const previews = await Promise.all(currentPages.map(async (pg) => ({ id: pg.id, url: await createReadUrl(pg.storagePath) })));

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
        <h2 className="text-lg font-medium">버전 히스토리</h2>
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between rounded-[8px] border border-border px-4 py-2">
              <span className="text-sm">
                v{v.versionNo}{v.note ? ` — ${v.note}` : ""}
                {v.id === proposal.currentVersionId && <Badge className="ml-2" variant="outline">current</Badge>}
              </span>
              <RestoreButton proposalId={proposal.id} versionId={v.id} isCurrent={v.id === proposal.currentVersionId} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">새 버전</h2>
        <AddVersionForm proposalId={proposal.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">현재 버전 미리보기</h2>
        {previews.length === 0 && <p className="text-sm text-muted-foreground">페이지가 없습니다.</p>}
        <div className="space-y-4">
          {previews.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt="" className="max-w-full border border-border" />
          ))}
        </div>
      </section>
    </div>
  );
}
