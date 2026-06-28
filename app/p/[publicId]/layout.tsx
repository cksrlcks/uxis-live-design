import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { RealtimeShell } from "@/widgets/realtime-shell";

// The layout persists across in-viewer navigations (?v=, ?compare=) on the same
// [publicId] segment, so the realtime channel mounted here is NOT torn down when
// switching variants. Mount the shell only after the access gate allows viewing.
//
// 라이브 모드가 꺼진 시안은 RealtimeShell(접속자 바·채팅·커서·협업 dock)을 아예 마운트하지
// 않는다. 이 결정은 서버에서 매 요청마다 내려지므로 클라이언트가 우회해 패널을 띄울 수 없고,
// 모든 뷰어가 셸을 띄우지 않으므로 Realtime 룸 자체가 비어 엿볼 협업 데이터도 없다.
export default async function PublicViewerLayout({
  params,
  children,
}: {
  params: Promise<{ publicId: string }>;
  children: React.ReactNode;
}) {
  const { publicId } = await params;
  const { proposal, decision, viewerName, viewer } = await resolveViewerGate(publicId);

  if (decision !== "allow" || !proposal?.liveMode) return <>{children}</>;

  return (
    <RealtimeShell publicId={publicId} viewerName={viewerName} viewerId={viewer?.id ?? null}>
      {children}
    </RealtimeShell>
  );
}
