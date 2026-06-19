import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { RealtimeShell } from "@/legacy/components/realtime/realtime-shell";

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
  const { decision, editorName } = await resolveViewerGate(publicId);

  if (decision !== "allow") return <>{children}</>;

  return (
    <RealtimeShell publicId={publicId} editorName={editorName}>
      {children}
    </RealtimeShell>
  );
}
