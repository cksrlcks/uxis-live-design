import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/session";
import { isEditor, type Role } from "@/lib/auth/roles";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(isEditor(profile.role as Role) ? "/dashboard" : "/pending");
}
