import Link from "next/link";
import { LoginForm } from "@/features/auth";
import { Card } from "@/shared/ui/card";

export function LoginPage({ returnTo }: { returnTo?: string }) {
  const signupHref = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup";
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="border-border shadow-layered-2 w-full max-w-sm gap-0 rounded-lg border p-8 ring-0">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.12em] uppercase">
          UXIS LIVE DESIGN
        </p>
        <h1 className="mt-3 text-2xl font-medium tracking-tight">로그인</h1>
        <p className="text-muted-foreground mt-1 text-sm">이메일로 계속하세요</p>
        <LoginForm returnTo={returnTo} />
        <div className="border-border mt-6 border-t pt-4 text-sm">
          <span className="text-muted-foreground">계정이 없으신가요? </span>
          <Link href={signupHref} className="underline">
            가입
          </Link>
        </div>
      </Card>
    </div>
  );
}
