"use client";

import { BookOpen, Home, LogOut } from "lucide-react";
import Image from "next/image";
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
    <aside className="bg-background sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r p-3">
      {/* 워크스페이스 마크 — /studio 로 이동. */}
      <Link
        href="/studio"
        className="rounded-control flex items-center p-2 transition-opacity hover:opacity-70"
      >
        <Image src="/logo.svg" alt="COVA" width={62} height={16} className="h-4 w-auto" priority />
      </Link>

      {/* 네비 */}
      <nav className="mt-4 flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive = active?.href === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-control relative flex items-center gap-2.5 px-2.5 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary before:bg-primary font-medium before:absolute before:top-1.5 before:bottom-1.5 before:-left-3 before:w-0.75 before:rounded-r before:content-['']"
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

      {/* 매뉴얼 바로가기 — 외부 사용 가이드. 새 탭으로 이동. */}
      <a
        href="https://cova-manual.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground/80 hover:bg-muted rounded-control flex items-center gap-2.5 px-2.5 py-2 text-sm transition-colors"
      >
        <BookOpen className="size-4" />
        매뉴얼
      </a>

      {/* 홈으로 — 스튜디오 밖 랜딩(/)으로 이동. 스튜디오 섹션 네비와 분리. */}
      <Link
        href="/"
        className="text-foreground/80 hover:bg-muted rounded-control flex items-center gap-2.5 px-2.5 py-2 text-sm transition-colors"
      >
        <Home className="size-4" />
        홈으로
      </Link>

      {/* 유저 푸터 — 정보 카드 + 아이콘 로그아웃. 계정 드롭다운은 후속. */}
      <div className="mt-3 border-t pt-3">
        <div className="rounded-card flex items-center gap-2.5 p-2">
          <Link
            href="/me"
            className="rounded-control flex min-w-0 flex-1 items-center gap-2.5 transition-opacity hover:opacity-70"
          >
            <span
              className="bg-foreground text-background flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium"
              aria-hidden="true"
            >
              {initial}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="text-muted-foreground block truncate text-xs">{email}</span>
            </span>
          </Link>
          <LogoutButton
            variant="ghost"
            size="icon-sm"
            aria-label="로그아웃"
            className="text-muted-foreground hover:text-foreground shrink-0 hover:bg-transparent dark:hover:bg-transparent"
          >
            <LogOut className="size-4" />
          </LogoutButton>
        </div>
      </div>
    </aside>
  );
}
