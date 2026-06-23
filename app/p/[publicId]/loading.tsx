import { Loader2 } from "lucide-react";

// Shown while the server gate component resolves (resolveViewerGate). Variant
// content itself loads client-side via React Query after the gate decision —
// that step shows the same centered spinner (see PublicViewerPage) so the two
// loading phases look identical.
export default function PublicViewerLoading() {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center">
      <Loader2 className="text-muted-foreground size-8 animate-spin" aria-hidden="true" />
      <span className="sr-only">불러오는 중…</span>
    </div>
  );
}
