"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { useLogout } from "../api/use-auth";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const logoutMutation = useLogout();

  async function onClick() {
    // Always navigate to /login even if the POST fails (network/500/403) — the old server
    // action redirected unconditionally; the proxy re-gates /dashboard if the cookie survived.
    try {
      await logoutMutation.mutateAsync();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={onClick}
      disabled={logoutMutation.isPending}
    >
      로그아웃
    </Button>
  );
}
