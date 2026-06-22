"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { useLogout } from "../api/use-auth";

type LogoutButtonProps = {
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  "aria-label"?: string;
  children?: ReactNode;
};

export function LogoutButton({
  className,
  variant = "outline",
  size,
  children = "로그아웃",
  ...rest
}: LogoutButtonProps) {
  const logoutMutation = useLogout();

  async function onClick() {
    // Always navigate to /login even if the POST fails (network/500/403) — the old server
    // action redirected unconditionally; the proxy re-gates /studio if the cookie survived.
    // Use a full-document load (not router.replace+refresh): refresh() only clears the client
    // cache for the *current* route, so the cached /studio segment — with the old user's
    // server-rendered name — would survive and reappear on the next login.
    try {
      await logoutMutation.mutateAsync();
    } finally {
      window.location.replace("/login");
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      disabled={logoutMutation.isPending}
      {...rest}
    >
      {children}
    </Button>
  );
}
