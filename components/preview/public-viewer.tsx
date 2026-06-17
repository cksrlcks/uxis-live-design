"use client";
import { useMemo } from "react";
import { useQueryStates, parseAsString } from "nuqs";
import type { ViewerVariant } from "@/lib/preview/load-variants";
import { ProposalPreview } from "./proposal-preview";
import { CompareView } from "./compare-view";
import { VariantViewerNav } from "./variant-viewer-nav";
import { VariantList } from "./variant-list";
import { usePrefetchImages } from "./use-prefetch-images";

// The whole public viewer runs client-side. The server renders this once with
// EVERY variant's pages already signed; switching list ↔ 안 ↔ 나란히 here only
// updates the URL (shallow → no server round-trip) and swaps already-loaded,
// already-cached images, so it's instant. The URL contract is unchanged
// (?v=slug single, ?compare=1 side-by-side, neither = list) so shared/deep links
// and the back button still work.
export function PublicViewer({ variants }: { variants: ViewerVariant[] }) {
  const [{ v, compare }, setQuery] = useQueryStates(
    { v: parseAsString, compare: parseAsString },
    { shallow: true, history: "push" },
  );

  // Warm every image in the background so the first switch is already cached.
  const allUrls = useMemo(() => variants.flatMap((vr) => vr.pages.map((p) => p.url)), [variants]);
  usePrefetchImages(allUrls);

  const navItems = useMemo(() => variants.map((vr) => ({ slug: vr.slug, label: vr.label })), [variants]);

  const showList = () => setQuery({ v: null, compare: null });
  const showVariant = (slug: string) => setQuery({ v: slug, compare: null });
  const showCompare = () => setQuery({ v: null, compare: "1" });

  if (compare) {
    const columns = variants.map((vr) => ({ slug: vr.slug, label: vr.label, pages: vr.pages }));
    return (
      <div className="flex h-screen w-screen flex-col">
        <VariantViewerNav items={navItems} activeSlug="" onList={showList} onSelect={showVariant} onCompare={showCompare} />
        <div className="min-h-0 flex-1"><CompareView columns={columns} /></div>
      </div>
    );
  }

  const active = v ? variants.find((vr) => vr.slug === v) : null;
  if (active) {
    return (
      <div className="flex h-screen w-screen flex-col">
        <VariantViewerNav items={navItems} activeSlug={active.slug} onList={showList} onSelect={showVariant} onCompare={showCompare} />
        {/* key resets per-variant view state (slide index, canvas zoom); the
            fullscreen/canvas choice lives in ?view so it survives the remount. */}
        <div className="min-h-0 flex-1"><ProposalPreview key={active.slug} pages={active.pages} /></div>
      </div>
    );
  }

  // Default: list of 안. (Includes the case where ?v points to an unknown slug.)
  const cards = variants.map((vr) => ({
    slug: vr.slug,
    label: vr.label,
    thumb: vr.pages[0] ?? null,
    pageCount: vr.pages.length,
  }));
  return <VariantList items={cards} onOpen={showVariant} />;
}
