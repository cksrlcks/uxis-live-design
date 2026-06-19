import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isEditor, type Role } from "@/shared/auth/roles";
import { RecentProposalsPage } from "@/pages/recent-proposals";

export async function HomePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (isEditor(profile.role as Role)) redirect("/studio");
  return <RecentProposalsPage />;
}
