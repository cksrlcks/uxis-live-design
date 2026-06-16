import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVariants, proposalPages } from "@/drizzle/schema";
import type { ProposalVariant } from "@/drizzle/schema";
import { getProfile } from "@/lib/auth/session";
import { isEditor, type Role } from "@/lib/auth/roles";
import { decideAccess } from "@/lib/proposals/access";
import { verifyUnlockToken, unlockCookieName } from "@/lib/access/cookie";
import { createReadUrl } from "@/lib/proposals/storage";
import type { PreviewPage } from "@/lib/preview/types";
import { ProposalPreview } from "@/components/preview/proposal-preview";
import { VariantList } from "@/components/preview/variant-list";
import { CompareView } from "@/components/preview/compare-view";
import { VariantViewerNav } from "@/components/preview/variant-viewer-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { unlock } from "./actions";

async function loadPages(versionId: string | null): Promise<PreviewPage[]> {
  if (!versionId) return [];
  const pages = await db.select().from(proposalPages)
    .where(eq(proposalPages.versionId, versionId)).orderBy(asc(proposalPages.pageOrder));
  return Promise.all(pages.map(async (pg) => ({
    id: pg.id, url: await createReadUrl(pg.storagePath), width: pg.width, height: pg.height,
  })));
}

export default async function PublicViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ error?: string; v?: string; compare?: string }>;
}) {
  const { publicId } = await params;
  const { error, v, compare } = await searchParams;

  const rows = await db.select().from(proposals).where(eq(proposals.publicId, publicId)).limit(1);
  const proposal = rows[0];
  if (!proposal) notFound();

  const profile = await getProfile();
  const editor = isEditor(profile?.role as Role | undefined);

  const cookieStore = await cookies();
  const token = cookieStore.get(unlockCookieName(publicId))?.value ?? "";
  // Server component renders once per request; reading the request-time clock here is intentional.
  // eslint-disable-next-line react-hooks/purity
  const nowSec = Math.floor(Date.now() / 1000);
  const hasValidUnlock = !!token &&
    verifyUnlockToken(token, publicId, nowSec, process.env.ACCESS_TOKEN_SECRET!);

  const decision = decideAccess({
    visibility: proposal.visibility,
    hasPassword: !!proposal.accessPasswordHash,
    isEditor: editor,
    hasValidUnlock,
  });

  if (decision === "forbidden") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-xl font-semibold">비공개 시안</h1>
        <p className="text-sm text-muted-foreground">이 시안은 비공개입니다. 편집자 로그인이 필요합니다.</p>
        <a href="/login" className="text-sm underline">로그인</a>
      </div>
    );
  }

  if (decision === "need-password") {
    const unlockWithId = unlock.bind(null, publicId);
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-sm p-8">
          <h1 className="text-xl font-semibold tracking-tight">{proposal.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">비밀번호가 필요한 시안입니다.</p>
          <form action={unlockWithId} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error && <p className="text-sm text-destructive">비밀번호가 올바르지 않습니다.</p>}
            <Button type="submit" className="w-full">열기</Button>
          </form>
        </Card>
      </div>
    );
  }

  // decision === "allow"
  const variants: ProposalVariant[] = await db.select().from(proposalVariants)
    .where(eq(proposalVariants.proposalId, proposal.id)).orderBy(asc(proposalVariants.sortOrder));
  const navItems = variants.map((vr) => ({ slug: vr.slug, label: vr.label }));

  // 나란히 비교
  if (compare) {
    const columns = await Promise.all(
      variants.map(async (vr) => ({ slug: vr.slug, label: vr.label, pages: await loadPages(vr.currentVersionId) })),
    );
    return (
      <div className="flex h-screen w-screen flex-col">
        <VariantViewerNav publicId={publicId} items={navItems} activeSlug="" />
        <div className="min-h-0 flex-1"><CompareView columns={columns} /></div>
      </div>
    );
  }

  // 특정 안 (?v=slug)
  if (v) {
    const variant = variants.find((vr) => vr.slug === v);
    if (!variant) notFound();
    const previews = await loadPages(variant.currentVersionId);
    return (
      <div className="flex h-screen w-screen flex-col">
        <VariantViewerNav publicId={publicId} items={navItems} activeSlug={variant.slug} />
        <div className="min-h-0 flex-1"><ProposalPreview pages={previews} /></div>
      </div>
    );
  }

  // 기본: 안 목록
  const items = await Promise.all(
    variants.map(async (vr) => {
      const pages = await loadPages(vr.currentVersionId);
      return { slug: vr.slug, label: vr.label, thumb: pages[0] ?? null, pageCount: pages.length };
    }),
  );
  return <VariantList publicId={publicId} items={items} />;
}
