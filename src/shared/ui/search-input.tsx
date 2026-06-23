"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Input } from "./input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

// 목록 상단 공용 검색 입력 — 좌측 돋보기 아이콘 + 입력값이 있을 때 우측 지우기 버튼.
// 제어 컴포넌트로 동작하며 value/onChange는 상위(URL 쿼리 상태 등)에서 관리한다.
export function SearchInput({
  value,
  onChange,
  placeholder = "검색",
  className,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-9 pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="검색어 지우기"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 transition-colors"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
