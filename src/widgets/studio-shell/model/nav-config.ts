import { Layers, Users, Tags } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isAdmin, type Role } from "@/shared/auth/roles";

export type NavItem = {
  href: string; // 섹션 루트
  label: string; // 사이드바 라벨 + 브레드크럼 섹션명
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/studio/proposals", label: "시안", icon: Layers },
  { href: "/studio/tags", label: "태그 설정", icon: Tags, adminOnly: true },
  { href: "/studio/users", label: "사용자 관리", icon: Users, adminOnly: true },
];

/** 현재 경로의 네비 항목. 정확히 일치하거나 하위 경로(`href + "/"`)면 활성. */
export function matchNav(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );
}

/** 역할에 따라 노출할 항목(adminOnly 항목은 admin에게만). */
export function visibleNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin(role));
}
