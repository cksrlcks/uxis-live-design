import type { PreviewPage } from "@/lib/preview/types";

export type VariantCard = { slug: string; label: string; thumb: PreviewPage | null; pageCount: number };

export function VariantList({ publicId, items }: { publicId: string; items: VariantCard[] }) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">안 목록</h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <a key={it.slug} href={`/p/${publicId}?v=${it.slug}`}
            className="group block overflow-hidden rounded-[8px] border border-border transition hover:border-foreground">
            <div className="flex aspect-[4/3] items-center justify-center bg-muted">
              {it.thumb
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={it.thumb.url} alt={it.label} className="h-full w-full object-contain" />
                : <span className="text-sm text-muted-foreground">미리보기 없음</span>}
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">{it.label}</span>
              <span className="text-xs text-muted-foreground">{it.pageCount}p</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
