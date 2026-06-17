"use client";
import type { PreviewPage } from "@/legacy/lib/preview/types";

export type VariantCard = { slug: string; label: string; thumb: PreviewPage | null; pageCount: number };

// Grid of 안(variant) cards. Opening a card switches the viewer in client state
// (onOpen) rather than navigating, so no server round-trip and the prefetched
// images render instantly.
export function VariantList({ items, onOpen }: { items: VariantCard[]; onOpen: (slug: string) => void }) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">안 목록</h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <button key={it.slug} type="button" onClick={() => onOpen(it.slug)}
            className="group block cursor-pointer overflow-hidden rounded-[8px] border border-border text-left transition hover:border-foreground">
            <div className="flex aspect-4/3 items-center justify-center bg-muted">
              {it.thumb
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={it.thumb.url} alt={it.label} className="h-full w-full object-contain" />
                : <span className="text-sm text-muted-foreground">미리보기 없음</span>}
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">{it.label}</span>
              <span className="text-xs text-muted-foreground">{it.pageCount}p</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
