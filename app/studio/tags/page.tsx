import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isAdmin, type Role } from "@/shared/auth/roles";
import { AdminTagsPage } from "@/pages/admin-tags";

export default async function Page() {
  const profile = await getProfile();
  if (!profile || !isAdmin(profile.role as Role)) redirect("/studio");
  return <AdminTagsPage />;
}
