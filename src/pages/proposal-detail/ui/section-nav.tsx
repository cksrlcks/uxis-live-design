"use client";

import { Layers, Settings, Tag } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export type SectionId = "settings" | "variants" | "tags";

const SECTIONS = [
  { id: "settings", label: "사이트설정", icon: Settings },
  { id: "variants", label: "시안설정", icon: Layers },
  { id: "tags", label: "태그관리", icon: Tag },
] as const;

// 좌측 탭 메뉴 — 선택한 탭만 본문에 표시한다(상태는 ?tab URL 파라미터). 활성 효과는
// 스튜디오 GNB와 동일하게 primary 틴트 + 좌측 액센트 바.
export function SectionNav({
  value,
  onChange,
}: {
  value: SectionId;
  onChange: (id: SectionId) => void;
}) {
  return (
    <nav className="flex flex-col gap-1" role="tablist" aria-orientation="vertical">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-selected={value === s.id}
          onClick={() => onChange(s.id)}
          className={cn(
            "flex h-11 cursor-pointer items-center gap-3 rounded-lg px-3.5 text-left text-[15px] transition-colors",
            value === s.id
              ? "bg-foreground/10 text-foreground font-medium"
              : "text-foreground/80 hover:bg-foreground/5",
          )}
        >
          <s.icon className="size-4.5 shrink-0" aria-hidden />
          {s.label}
        </button>
      ))}
    </nav>
  );
}
