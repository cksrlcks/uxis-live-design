import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isEditor, isAdmin, type Role } from "@/shared/auth/roles";
import { LogoutButton } from "@/features/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!isEditor(profile.role as Role)) redirect("/pending");

  return (
    <div className="flex min-h-screen">
      <aside className="border-border w-60 border-r p-4">
        <div className="mb-6 text-sm font-medium tracking-tight">uxis live design</div>
        <nav className="space-y-1 text-sm">
          <Link
            href="/dashboard/proposals"
            className="hover:bg-muted block rounded-[4px] px-3 py-2"
          >
            시안
          </Link>
          {isAdmin(profile.role as Role) && (
            <Link href="/admin/users" className="hover:bg-muted block rounded-[4px] px-3 py-2">
              사용자 관리
            </Link>
          )}
        </nav>
        <LogoutButton className="mt-6 w-full" />
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
