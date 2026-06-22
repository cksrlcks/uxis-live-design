import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { StandaloneChat } from "@/widgets/realtime-shell";
import { PoweredBy } from "@/shared/ui/powered-by";

// 채팅 단독 새 창(window.open 대상). [publicId] viewer 레이아웃 밖에 있어
// RealtimeShell(접속자 바/도크)을 상속하지 않고 채팅만 전체 화면으로 띄운다.
export default async function ChatPopupPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const { decision, viewerName, viewer } = await resolveViewerGate(publicId);

  if (decision !== "allow") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted-foreground text-sm">채팅을 열 수 없습니다.</p>
        <PoweredBy className="mt-2" />
      </div>
    );
  }

  return (
    <StandaloneChat publicId={publicId} viewerName={viewerName} viewerId={viewer?.id ?? null} />
  );
}
