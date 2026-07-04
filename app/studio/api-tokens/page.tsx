import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isEditor, type Role } from "@/shared/auth/roles";
import { ApiTokensPage } from "@/pages/api-tokens";

export default async function Page() {
  const profile = await getProfile();
  if (!profile || !isEditor(profile.role as Role)) redirect("/studio");
  return <ApiTokensPage />;
}
