import { logout } from "../(auth)/actions";
import { Button } from "@/legacy/components/ui/button";

export default function PendingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
      <h1 className="text-2xl font-semibold tracking-tight">승인 대기 중</h1>
      <p className="text-sm text-muted-foreground">관리자 승인 후 시안을 관리할 수 있습니다.</p>
      <form action={logout}><Button type="submit" variant="outline">로그아웃</Button></form>
    </div>
  );
}
