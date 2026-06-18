"use client";
import { useMemo } from "react";
import { useQueryState, parseAsString } from "nuqs";
import type { EditorVariant } from "@/legacy/lib/preview/load-variants";
import { ProposalPreview } from "./proposal-preview";
import { usePrefetchImages } from "./use-prefetch-images";
import { AddVersionForm } from "@/features/add-version";
import { RestoreButton } from "@/features/restore-version";
import { Badge } from "@/shared/ui/badge";

// Version history + current-version preview for the active 안. Reads ?variant
// (variant id) from the URL — the same param VariantTabs writes — so selecting a
// tab swaps these sections client-side (shallow, no server round-trip). All
// variants' pages are signed once on the server and prefetched here, so switching
// is instant and images don't re-download.
export function ProposalEditorPreview({ proposalId, variants }: {
  proposalId: string; variants: EditorVariant[];
}) {
  const [variantId] = useQueryState("variant", parseAsString.withOptions({ shallow: true, history: "push" }));
  const active = variants.find((v) => v.id === variantId) ?? variants[0];

  const allUrls = useMemo(() => variants.flatMap((v) => v.pages.map((p) => p.url)), [variants]);
  usePrefetchImages(allUrls);

  if (!active) return null;

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">버전 히스토리 — {active.label}</h2>
        <ul className="space-y-2">
          {active.versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between rounded-[8px] border border-border px-4 py-2">
              <span className="text-sm">
                v{v.versionNo}{v.note ? ` — ${v.note}` : ""}
                {v.id === active.currentVersionId && <Badge className="ml-2" variant="outline">current</Badge>}
              </span>
              <RestoreButton proposalId={proposalId} variantId={active.id} versionId={v.id} isCurrent={v.id === active.currentVersionId} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">새 버전 — {active.label}</h2>
        <AddVersionForm proposalId={proposalId} variantId={active.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">현재 버전 미리보기 — {active.label}</h2>
        <div className="h-[80vh] overflow-hidden rounded-[8px] border border-border">
          {/* key resets per-variant preview state on switch; ?view persists it */}
          <ProposalPreview key={active.id} pages={active.pages} />
        </div>
      </section>
    </>
  );
}
