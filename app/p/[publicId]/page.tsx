import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalPages } from "@/drizzle/schema";
import { getProfile } from "@/lib/auth/session";
import { isEditor, type Role } from "@/lib/auth/roles";
import { decideAccess } from "@/lib/proposals/access";
import { verifyUnlockToken, unlockCookieName } from "@/lib/access/cookie";
import { createReadUrl } from "@/lib/proposals/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { unlock } from "./actions";

export default async function PublicViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { publicId } = await params;
  const { error } = await searchParams;

  const rows = await db.select().from(proposals).where(eq(proposals.publicId, publicId)).limit(1);
  const proposal = rows[0];
  if (!proposal) notFound();

  const profile = await getProfile();
  const editor = isEditor(profile?.role as Role | undefined);

  const cookieStore = await cookies();
  const token = cookieStore.get(unlockCookieName(publicId))?.value ?? "";
  const hasValidUnlock = !!token &&
    verifyUnlockToken(token, publicId, Math.floor(Date.now() / 1000), process.env.ACCESS_TOKEN_SECRET!);

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
  const pages = proposal.currentVersionId
    ? await db.select().from(proposalPages)
        .where(eq(proposalPages.versionId, proposal.currentVersionId)).orderBy(asc(proposalPages.pageOrder))
    : [];
  const previews = await Promise.all(pages.map(async (pg) => ({ id: pg.id, url: await createReadUrl(pg.storagePath) })));

  return (
    <div className="mx-auto max-w-[1920px]">
      {previews.length === 0 && <p className="p-8 text-sm text-muted-foreground">아직 페이지가 없습니다.</p>}
      {previews.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p.id} src={p.url} alt="" className="block w-full" />
      ))}
    </div>
  );
}
