import { FileX, Lock } from "lucide-react";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { PublicViewerPage as ClientViewerPage } from "@/pages/public-viewer";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
import { unlock } from "@/features/unlock-access";
import { PoweredBy } from "@/shared/ui/powered-by";

export default async function PublicViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { publicId } = await params;
  const { error } = await searchParams;

  const { proposal, decision, viewer } = await resolveViewerGate(publicId);
  if (!proposal) {
    return (
      <div className="bg-dot-grid flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-10">
        <Card className="w-full max-w-sm border-0 p-8 shadow-lg ring-0">
          <div className="flex flex-col items-center text-center">
            <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
              <FileX className="size-5" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-lg font-bold tracking-tight">볼 수 없는 시안</h1>
            <p className="text-muted-foreground mt-1.5 text-sm break-keep">
              시안이 삭제되었거나, 볼 수 없는 상태입니다.
            </p>
          </div>
        </Card>
        <PoweredBy />
      </div>
    );
  }

  if (decision === "forbidden") {
    return (
      <div className="bg-dot-grid flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-10">
        <Card className="w-full max-w-sm border-0 p-8 shadow-lg ring-0">
          <div className="flex flex-col items-center text-center">
            <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
              <Lock className="size-5" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-lg font-bold tracking-tight">비공개 시안</h1>
            <p className="text-muted-foreground mt-1.5 text-sm break-keep">
              시안을 확인하려면 관리자 권한이 필요합니다.
            </p>
          </div>
        </Card>
        <PoweredBy />
      </div>
    );
  }

  if (decision === "need-password") {
    const unlockWithId = unlock.bind(null, publicId);
    return (
      <div className="bg-dot-grid flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-10">
        <Card className="w-full max-w-sm border-0 p-8 shadow-lg ring-0">
          <div className="flex flex-col items-center text-center">
            <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
              <Lock className="size-5" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-lg font-bold tracking-tight break-keep">{proposal.title}</h1>
            <p className="text-muted-foreground mt-1.5 text-sm tracking-tight">
              비밀번호가 필요한 시안입니다.
            </p>
          </div>

          <form action={unlockWithId} className="space-y-4">
            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-muted-foreground font-normal">
                비밀번호
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoFocus
                placeholder="비밀번호를 입력하세요"
                className="h-12 rounded-lg px-4"
              />
              {error && (
                <p className="text-destructive text-sm">비밀번호가 올바르지 않습니다.</p>
              )}
            </div>

            <Label
              htmlFor="remember"
              className="text-muted-foreground flex w-fit cursor-pointer items-center gap-2 text-sm font-normal select-none"
            >
              <input
                id="remember"
                name="remember"
                type="checkbox"
                className="border-input accent-primary size-4 rounded border"
              />
              하루동안 기억하기
            </Label>

            <Button type="submit" className="h-12 w-full rounded-lg text-base font-semibold">
              열기
            </Button>
          </form>
        </Card>
        <PoweredBy />
      </div>
    );
  }

  // decision === "allow": content is fetched client-side via React Query (guarded GET).
  return (
    <ClientViewerPage
      publicId={publicId}
      viewer={viewer ? { id: viewer.id } : null}
      proposalTitle={proposal.title}
      whiteboardEnabled={proposal.whiteboardEnabled}
      liveMode={proposal.liveMode}
    />
  );
}
