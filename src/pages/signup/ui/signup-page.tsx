import Link from "next/link";
import { AuthLayout, SignupForm } from "@/features/auth";

export function SignupPage({ returnTo }: { returnTo?: string }) {
  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
  return (
    <AuthLayout
      title="회원가입"
      subtitle="정보를 입력하고 가입을 완료해주세요"
      footer={
        <>
          이미 계정이 있으신가요?{" "}
          <Link
            href={loginHref}
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            로그인
          </Link>
        </>
      }
    >
      <SignupForm returnTo={returnTo} />
    </AuthLayout>
  );
}
