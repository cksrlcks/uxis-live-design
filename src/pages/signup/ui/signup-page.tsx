import Link from "next/link";
import { SignupForm } from "@/features/auth";
import { Card } from "@/shared/ui/card";

export function SignupPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight">회원가입</h1>
        <p className="text-muted-foreground mt-2 text-sm">가입 후 관리자 승인이 필요합니다.</p>
        <SignupForm />
        <Link href="/login" className="mt-4 block text-sm underline">
          이미 계정이 있으신가요? 로그인
        </Link>
      </Card>
    </div>
  );
}
