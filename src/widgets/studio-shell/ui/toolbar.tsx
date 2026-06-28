import type { ReactNode } from "react";

/** 목록 페이지 상단 컨트롤 줄: 좌측 슬롯(children) + 우측 정렬(trailing). */
export function Toolbar({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {children}
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}
