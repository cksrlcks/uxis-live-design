import { LogoutButton } from "@/features/auth";

export function PendingPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">승인 대기 중</h1>
      <p className="text-muted-foreground text-sm">관리자 승인 후 시안을 관리할 수 있습니다.</p>
      <LogoutButton />
    </div>
  );
}
