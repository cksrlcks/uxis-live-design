import { SignupPage } from "@/pages/signup";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return <SignupPage returnTo={returnTo} />;
}
