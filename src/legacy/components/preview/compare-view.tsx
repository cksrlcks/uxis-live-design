import type { PreviewPage } from "@/legacy/lib/preview/types";

export type CompareColumn = { slug: string; label: string; pages: PreviewPage[] };

export function CompareView({ columns }: { columns: CompareColumn[] }) {
  return (
    <div className="flex h-full w-full gap-4 overflow-x-auto p-4">
      {columns.map((col) => (
        <div key={col.slug} className="flex h-full min-w-[280px] flex-1 flex-col">
          <div className="mb-2 shrink-0 text-center text-sm font-medium">{col.label}</div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-[8px] border border-border p-2">
            {col.pages.length === 0
              ? <p className="py-8 text-center text-xs text-muted-foreground">미리보기 없음</p>
              : col.pages.map((pg) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={pg.id} src={pg.url} alt="" className="w-full" />
                ))}
          </div>
        </div>
      ))}
    </div>
  );
}
