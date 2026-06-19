import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { RealtimeShell } from "@/legacy/components/realtime/realtime-shell";
import { loadRecentChat } from "@/legacy/lib/meeting/load-chat";

// The layout persists across in-viewer navigations (?v=, ?compare=) on the same
// [publicId] segment, so the realtime channel mounted here is NOT torn down when
// switching variants. Mount the shell only after the access gate allows viewing.
export default async function PublicViewerLayout({
  params,
  children,
}: {
  params: Promise<{ publicId: string }>;
  children: React.ReactNode;
}) {
  const { publicId } = await params;
  const { proposal, decision, editorName } = await resolveViewerGate(publicId);

  if (decision !== "allow" || !proposal) return <>{children}</>;

  const initialChat = await loadRecentChat(proposal.id);

  return (
    <RealtimeShell publicId={publicId} editorName={editorName} initialChat={initialChat}>
      {children}
    </RealtimeShell>
  );
}
