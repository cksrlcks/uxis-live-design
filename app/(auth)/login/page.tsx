import { LoginPage } from "@/pages/login";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; reset?: string }>;
}) {
  const { returnTo, reset } = await searchParams;
  const notice =
    reset === "success" ? "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요." : undefined;
  return <LoginPage returnTo={returnTo} notice={notice} />;
}
