import { redirect } from "next/navigation";
import { getSessionUser } from "@/shared/auth/guards.server";
import { ResetPasswordPage } from "@/pages/reset-password";

export default async function Page() {
  // /auth/confirm가 심은 recovery 세션이 있어야 진입 가능. 없으면 직접 접근/만료로 간주.
  const user = await getSessionUser();
  if (!user) redirect("/forgot-password?error=expired");
  return <ResetPasswordPage />;
}
