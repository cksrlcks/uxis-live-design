"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/features/auth";
import { type Role } from "@/shared/auth/roles";
import { cn } from "@/shared/lib/utils";
import { matchNav, visibleNavItems } from "../model/nav-config";

type StudioSidebarProps = {
  displayName: string | null;
  email: string;
  role: Role;
};

export function StudioSidebar({ displayName, email, role }: StudioSidebarProps) {
  const pathname = usePathname() ?? "";
  const active = matchNav(pathname);
  const items = visibleNavItems(role);
  const name = displayName ?? "사용자";
  const initial = (displayName ?? email).charAt(0).toUpperCase();

  return (
    <aside className="bg-background flex w-56 shrink-0 flex-col border-r p-3">
      {/* 워크스페이스 마크 — 단일 워크스페이스라 비기능(스위처는 후속). /studio 로 이동. */}
      <Link
        href="/studio"
        className="hover:bg-muted flex items-center gap-2.5 rounded-lg border p-2 transition-colors"
      >
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-sm font-medium">
          U
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-medium">uxis</span>
          <span className="text-muted-foreground block text-xs">live design</span>
        </span>
        <span className="text-muted-foreground ml-auto text-xs">▾</span>
      </Link>

      {/* 그룹 라벨 */}
      <p className="text-muted-foreground mt-4 mb-1.5 px-2 text-xs font-medium tracking-[0.07em] uppercase">
        워크스페이스
      </p>

      {/* 네비 */}
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive = active?.href === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium before:absolute before:top-1.5 before:bottom-1.5 before:-left-3 before:w-0.75 before:rounded-r before:bg-primary before:content-['']"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* 유저 푸터 — 정보 + 로그아웃(기존 컴포넌트 재사용). 계정 드롭다운은 후속. */}
      <div className="mt-3 border-t pt-3">
        <div className="mb-2 flex items-center gap-2.5 px-1">
          <span className="bg-accent-purple flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white">
            {initial}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="text-muted-foreground block truncate text-xs">{email}</span>
          </span>
        </div>
        <LogoutButton className="w-full" />
      </div>
    </aside>
  );
}
