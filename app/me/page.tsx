import { redirect } from "next/navigation";
import { getProfile, getSessionUser } from "@/shared/auth/guards.server";
import { AccountPage } from "@/pages/my-page";

export default async function Page() {
  const [user, profile] = await Promise.all([getSessionUser(), getProfile()]);
  if (!profile) redirect("/login?returnTo=/me");
  const isOAuthUser = !user?.identities?.some((id) => id.provider === "email");
  return (
    <AccountPage
      displayName={profile.displayName}
      email={profile.email}
      createdAt={profile.createdAt}
      isOAuthUser={isOAuthUser}
    />
  );
}
