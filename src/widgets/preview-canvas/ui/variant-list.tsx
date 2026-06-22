"use client";
import { ArrowUpRight } from "lucide-react";
import type { ProposalPage } from "@/entities/proposal";
import { PoweredBy } from "@/shared/ui/powered-by";

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
  title,
  items,
  onOpen,
}: {
  title: string;
  items: VariantCard[];
  onOpen: (slug: string) => void;
}) {
  return (
    // Clean light-gray canvas; content is vertically centered with a footer pinned below.
    <div className="flex min-h-screen flex-col bg-[#f4f4f5]">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <h1 className="mb-3 text-center text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground/70 mb-10 text-center text-sm">
          본 자료는 1920×1080(FHD) 해상도에 최적화되어 있습니다. <br />정확한 확인을 위해 데스크탑 환경에서 열람해 주시기 바랍니다.
        </p>
        {/* flex-wrap + justify-center so rows that aren't full (≤3 cards) center
            instead of left-aligning; basis values match the old 1/2/3-col grid. */}
        <div className="flex flex-wrap justify-center gap-7">
          {items.map((it) => (
            <button
              key={it.slug}
              type="button"
              onClick={() => onOpen(it.slug)}
              className="group block w-full grow-0 cursor-pointer overflow-hidden rounded-2xl border border-black/3 bg-card text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_18px_40px_-16px_rgba(0,0,0,0.22)] sm:basis-[calc(50%-14px)] lg:basis-[calc(33.333%-18.667px)]"
            >
              <div className="bg-muted aspect-video overflow-hidden">
                {it.thumb ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={it.thumb.url}
                    alt={it.label}
                    className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="text-muted-foreground flex h-full w-full items-center justify-center text-sm">
                    미리보기 없음
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex flex-col">
                  <span className="font-medium tracking-tight">{it.label}</span>
                  <span className="text-muted-foreground mt-0.5 text-xs">{it.pageCount} pages</span>
                </div>
                <span className="text-muted-foreground flex size-8 items-center justify-center rounded-full transition group-hover:bg-foreground group-hover:text-background">
                  <ArrowUpRight className="size-4" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <PoweredBy className="pb-10" />
    </div>
  );
}
