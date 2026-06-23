import { ForgotPasswordPage } from "@/pages/forgot-password";

const ERROR_NOTICES: Record<string, string> = {
  invalid: "링크가 유효하지 않거나 만료되었습니다. 다시 요청해주세요.",
  expired: "링크가 만료되었습니다. 다시 요청해주세요.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <ForgotPasswordPage notice={error ? ERROR_NOTICES[error] : undefined} />;
}
