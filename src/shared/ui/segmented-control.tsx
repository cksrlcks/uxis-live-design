"use client";

import type { LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTab } from "@/shared/ui/tabs";

type Option<T extends string> = { value: T; label: string; icon?: LucideIcon };

/** 뷰 토글용 세그먼트 컨트롤. Tabs 위에 표준 스타일을 입힌다. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
}: {
  value: T;
  options: Option<T>[];
  onValueChange: (value: T) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as T)}>
      <TabsList>
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <TabsTab key={opt.value} value={opt.value}>
              {Icon && <Icon aria-hidden />}
              {opt.label}
            </TabsTab>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
