"use client";

import { cn } from "@/shared/lib/utils";
import { PAGE_TYPES, type PageType } from "@/entities/ai-design";

const META: Record<PageType, { label: string; desc: string; thumb: React.ReactNode }> = {
  main: {
    label: "메인",
    desc: "랜딩 · 히어로 + 섹션",
    thumb: (
      <svg viewBox="0 0 120 80" className="h-full w-full" role="img" aria-label="메인 페이지 와이어프레임">
        <rect x="0" y="0" width="120" height="80" rx="4" className="fill-muted" />
        <rect x="10" y="8" width="100" height="22" rx="2" className="fill-primary/30" />
        <rect x="40" y="14" width="40" height="4" rx="2" className="fill-primary/60" />
        <rect x="50" y="22" width="20" height="4" rx="2" className="fill-foreground/30" />
        <rect x="10" y="36" width="30" height="20" rx="2" className="fill-foreground/15" />
        <rect x="45" y="36" width="30" height="20" rx="2" className="fill-foreground/15" />
        <rect x="80" y="36" width="30" height="20" rx="2" className="fill-foreground/15" />
        <rect x="35" y="64" width="50" height="6" rx="3" className="fill-primary/50" />
      </svg>
    ),
  },
  dashboard: {
    label: "대시보드",
    desc: "사이드바 + KPI/차트",
    thumb: (
      <svg viewBox="0 0 120 80" className="h-full w-full" role="img" aria-label="대시보드 와이어프레임">
        <rect x="0" y="0" width="120" height="80" rx="4" className="fill-muted" />
        <rect x="0" y="0" width="26" height="80" rx="4" className="fill-foreground/20" />
        <rect x="6" y="10" width="14" height="3" rx="1.5" className="fill-foreground/40" />
        <rect x="6" y="18" width="14" height="3" rx="1.5" className="fill-foreground/40" />
        <rect x="6" y="26" width="14" height="3" rx="1.5" className="fill-foreground/40" />
        <rect x="32" y="8" width="24" height="16" rx="2" className="fill-primary/30" />
        <rect x="60" y="8" width="24" height="16" rx="2" className="fill-primary/30" />
        <rect x="88" y="8" width="24" height="16" rx="2" className="fill-primary/30" />
        <rect x="32" y="30" width="80" height="42" rx="2" className="fill-foreground/15" />
        <polyline points="36,66 52,52 68,60 84,42 104,48" className="fill-none stroke-primary/70" strokeWidth="2" />
      </svg>
    ),
  },
  subpage: {
    label: "서브페이지",
    desc: "헤더 + 본문 + 사이드",
    thumb: (
      <svg viewBox="0 0 120 80" className="h-full w-full" role="img" aria-label="서브페이지 와이어프레임">
        <rect x="0" y="0" width="120" height="80" rx="4" className="fill-muted" />
        <rect x="0" y="0" width="120" height="14" rx="4" className="fill-foreground/20" />
        <rect x="8" y="5" width="24" height="4" rx="2" className="fill-foreground/45" />
        <rect x="10" y="22" width="64" height="5" rx="2" className="fill-foreground/40" />
        <rect x="10" y="32" width="64" height="3" rx="1.5" className="fill-foreground/20" />
        <rect x="10" y="38" width="64" height="3" rx="1.5" className="fill-foreground/20" />
        <rect x="10" y="44" width="48" height="3" rx="1.5" className="fill-foreground/20" />
        <rect x="82" y="22" width="30" height="48" rx="2" className="fill-primary/25" />
      </svg>
    ),
  },
};

export function PageTypeCards({
  value,
  onChange,
}: {
  value: PageType | null;
  onChange: (v: PageType) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {PAGE_TYPES.map((pt) => {
        const m = META[pt];
        const active = value === pt;
        return (
          <button
            key={pt}
            type="button"
            onClick={() => onChange(pt)}
            aria-pressed={active}
            className={cn(
              "flex flex-col gap-2 rounded-lg border p-2 text-left transition-all",
              active ? "border-primary ring-2 ring-primary/40" : "border-border hover:bg-muted",
            )}
          >
            <div className="aspect-[3/2] w-full overflow-hidden rounded-md">{m.thumb}</div>
            <div>
              <div className="text-sm font-medium">{m.label}</div>
              <div className="text-muted-foreground text-xs">{m.desc}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
