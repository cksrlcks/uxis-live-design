import { notFound } from "next/navigation";
import { resolveViewerGate } from "@/lib/access/viewer-gate";
import { loadVariantsForProposal } from "@/lib/preview/load-variants";
import { PublicViewer } from "@/components/preview/public-viewer";
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

  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) notFound();

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

  // decision === "allow": load every 안 with its pages once (one batch URL-signing
  // call), then let the client switch between them with no further server round-trips.
  const variants = await loadVariantsForProposal(proposal.id);
  return <PublicViewer variants={variants} />;
}
