"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { matchNav } from "../model/nav-config";

export function StudioTopbar() {
  const pathname = usePathname();
  const section = matchNav(pathname ?? "");

  return (
    <header className="bg-background/80 sticky top-0 z-10 flex h-12 items-center justify-between border-b px-6 backdrop-blur">
      <nav className="flex items-center gap-2 text-sm">
        <Link
          href="/studio"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          uxis
        </Link>
        {section && (
          <>
            <span className="text-muted-foreground">›</span>
            <span className="text-foreground font-medium">{section.label}</span>
          </>
        )}
      </nav>
      {/* 우측 슬롯(예약): 검색/도움말 실기능은 후속 하위작업 */}
      <div />
    </header>
  );
}
