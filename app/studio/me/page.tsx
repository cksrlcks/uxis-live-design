import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { type Role } from "@/shared/auth/roles";
import { MyPage } from "@/pages/my-page";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnTo=/studio/me");
  return (
    <MyPage
      displayName={profile.displayName}
      email={profile.email}
      role={profile.role as Role}
      createdAt={profile.createdAt}
    />
  );
}
