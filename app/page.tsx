import { redirect } from "next/navigation";
import { getProfile } from "@/legacy/lib/auth/session";
import { isEditor, type Role } from "@/legacy/lib/auth/roles";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(isEditor(profile.role as Role) ? "/dashboard" : "/pending");
}
