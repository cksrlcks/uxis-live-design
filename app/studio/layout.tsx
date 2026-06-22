import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isEditor, type Role } from "@/shared/auth/roles";
import { StudioShell } from "@/widgets/studio-shell";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!isEditor(profile.role as Role)) redirect("/pending");

  return (
    <StudioShell
      displayName={profile.displayName}
      email={profile.email}
      role={profile.role as Role}
    >
      {children}
    </StudioShell>
  );
}
