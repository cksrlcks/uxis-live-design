"use client";
import type { ProposalPage } from "@/entities/proposal";

export type VariantCard = {
  slug: string;
  label: string;
  thumb: ProposalPage | null;
  pageCount: number;
};

// Grid of 안(variant) cards. Opening a card switches the viewer in client state
// (onOpen) rather than navigating, so no server round-trip and the prefetched
// images render instantly.
export function VariantList({
  items,
  onOpen,
}: {
  items: VariantCard[];
  onOpen: (slug: string) => void;
}) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">안 목록</h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <button
            key={it.slug}
            type="button"
            onClick={() => onOpen(it.slug)}
            className="group border-border hover:border-foreground block cursor-pointer overflow-hidden rounded-[8px] border text-left transition"
          >
            <div className="bg-muted flex aspect-4/3 items-center justify-center">
              {it.thumb ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={it.thumb.url} alt={it.label} className="h-full w-full object-contain" />
              ) : (
                <span className="text-muted-foreground text-sm">미리보기 없음</span>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">{it.label}</span>
              <span className="text-muted-foreground text-xs">{it.pageCount}p</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
