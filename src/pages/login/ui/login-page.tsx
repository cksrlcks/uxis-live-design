import Link from "next/link";
import { AuthLayout, LoginForm } from "@/features/auth";

export function LoginPage({ returnTo }: { returnTo?: string }) {
  const signupHref = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup";
  return (
    <AuthLayout
      title="로그인"
      subtitle="가입하신 이메일로 로그인해주세요"
      footer={
        <>
          계정이 없으신가요?{" "}
          <Link
            href={signupHref}
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            회원가입
          </Link>
        </>
      }
    >
      <LoginForm returnTo={returnTo} />
    </AuthLayout>
  );
}
