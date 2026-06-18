import { LoginPage } from "@/pages/login";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return <LoginPage returnTo={returnTo} />;
}
