"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Input } from "./input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** onChange 호출 지연(ms). 0이면 즉시 호출. 기본 300. */
  debounceMs?: number;
  "aria-label"?: string;
};

// 목록 상단 공용 검색 입력 — 좌측 돋보기 아이콘 + 입력값이 있을 때 우측 지우기 버튼.
// 입력값은 즉시 화면에 반영하되 onChange는 debounceMs만큼 지연 호출한다(서버 검색 과호출 방지).
// value/onChange는 상위(URL 쿼리 상태 등)에서 관리한다.
export function SearchInput({
  value,
  onChange,
  placeholder = "검색",
  className,
  debounceMs = 300,
  "aria-label": ariaLabel,
}: Props) {
  const [inputValue, setInputValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 외부 value 변경(지우기·URL 동기화 등)을 입력값에 반영한다.
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // 언마운트 시 대기 중인 디바운스 타이머 정리.
  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleChange(next: string) {
    setInputValue(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(next), debounceMs);
  }

  // 지우기는 디바운스를 건너뛰고 즉시 반영한다.
  function handleClear() {
    clearTimeout(timerRef.current);
    setInputValue("");
    onChange("");
  }

  return (
    <div className={cn("group relative", className)}>
      <Search
        className="text-muted-foreground/70 group-focus-within:text-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 transition-colors"
        aria-hidden
      />
      <Input
        type="search"
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="bg-background h-10 rounded-lg pr-10 pl-10 text-sm transition-colors [&::-webkit-search-cancel-button]:hidden"
      />
      {inputValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="검색어 지우기"
          className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full transition-colors"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
