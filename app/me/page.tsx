import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { AccountPage } from "@/pages/my-page";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnTo=/me");
  return (
    <AccountPage
      displayName={profile.displayName}
      email={profile.email}
      createdAt={profile.createdAt}
    />
  );
}
