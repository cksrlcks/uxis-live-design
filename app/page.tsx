import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isEditor, type Role } from "@/shared/auth/roles";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(isEditor(profile.role as Role) ? "/dashboard" : "/pending");
}
