import Link from "next/link";
import { LoginForm } from "@/features/auth";
import { Card } from "@/shared/ui/card";

export function LoginPage({ returnTo }: { returnTo?: string }) {
  const signupHref = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup";
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        <LoginForm returnTo={returnTo} />
        <Link href={signupHref} className="mt-4 block text-sm underline">
          계정이 없으신가요? 가입
        </Link>
      </Card>
    </div>
  );
}
