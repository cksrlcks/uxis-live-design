import Link from "next/link";
import { AuthLayout, ForgotPasswordForm } from "@/features/auth";

export function ForgotPasswordPage({ notice }: { notice?: string }) {
  return (
    <AuthLayout
      title="비밀번호 재설정"
      subtitle="가입하신 이메일로 재설정 링크를 보내드립니다"
      footer={
        <>
          비밀번호가 기억나셨나요?{" "}
          <Link
            href="/login"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            로그인
          </Link>
        </>
      }
    >
      {notice && (
        <p className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
