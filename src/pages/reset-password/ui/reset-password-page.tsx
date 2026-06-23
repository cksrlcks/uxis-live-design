import { AuthLayout, ResetPasswordForm } from "@/features/auth";

export function ResetPasswordPage() {
  return (
    <AuthLayout title="새 비밀번호 설정" subtitle="새로 사용할 비밀번호를 입력해주세요" footer={null}>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
