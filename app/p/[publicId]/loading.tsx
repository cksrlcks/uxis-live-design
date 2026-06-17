import { Skeleton } from "@/components/ui/skeleton";

// Shown while the page server component loads — the slow part is signing every
// 안's page URLs in one batch (loadVariantsForProposal). Mirrors the default
// landing view (안 목록 grid in VariantList) so the skeleton matches what lands.
export default function PublicViewerLoading() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <Skeleton className="mb-6 h-7 w-28" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[8px] border border-border">
            <Skeleton className="aspect-4/3 rounded-none" />
            <div className="flex items-center justify-between px-4 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
