import Link from "next/link";
import { AuthLayout, SignupForm } from "@/features/auth";

export function SignupPage({ returnTo }: { returnTo?: string }) {
  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
  return (
    <AuthLayout
      title="회원가입"
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
