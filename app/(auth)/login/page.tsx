import { LoginPage } from "@/pages/login";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; reset?: string; error?: string }>;
}) {
  const { returnTo, reset, error } = await searchParams;
  const notice =
    reset === "success" ? "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요." : undefined;
  const errorMessage =
    error === "oauth" ? "구글 로그인에 실패했습니다. 다시 시도해주세요." : undefined;
  return <LoginPage returnTo={returnTo} notice={notice} error={errorMessage} />;
}
