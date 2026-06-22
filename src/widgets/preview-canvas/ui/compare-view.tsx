import type { ProposalPage } from "@/entities/proposal";

export type CompareColumn = { slug: string; label: string; pages: ProposalPage[] };

// 안(variant)들을 좌우로 나란히 놓고 페이지를 동시에 훑어보는 비교 뷰.
// variant-list와 같은 라이트 그레이 캔버스 톤을 쓰고, 각 컬럼은 sticky 헤더로
// 스크롤 중에도 어떤 안인지 유지된다. 하단은 플로팅 독(public-viewer)에 가리지
// 않도록 여백을 둔다.
export function CompareView({ columns }: { columns: CompareColumn[] }) {
  return (
    <div className="h-full w-full overflow-x-auto bg-[#f4f4f5]">
      <div className="flex h-full min-w-fit gap-6 px-6 pt-6 pb-28">
        {columns.map((col) => (
          <div key={col.slug} className="flex h-full min-w-75 flex-1 flex-col">
            <div className="sticky top-0 z-10 mb-3 flex shrink-0 justify-center">
              <span className="rounded-full bg-foreground/90 px-4 py-1.5 text-xs font-medium text-background shadow-sm backdrop-blur-md">
                {col.label}
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto border border-black/15 p-3">
              {col.pages.length === 0 ? (
                <div className="text-muted-foreground/70 flex h-full items-center justify-center py-16 text-xs">
                  미리보기 없음
                </div>
              ) : (
                col.pages.map((pg) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={pg.id} src={pg.url} alt="" className="w-full" />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
