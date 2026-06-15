import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/session";
import { isEditor, isAdmin, type Role } from "@/lib/auth/roles";
import { logout } from "../(auth)/actions";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!isEditor(profile.role as Role)) redirect("/pending");

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r border-border p-4">
        <div className="mb-6 text-sm font-medium tracking-tight">uxis live design</div>
        <nav className="space-y-1 text-sm">
          <a href="/dashboard/proposals" className="block rounded-[4px] px-3 py-2 hover:bg-muted">시안</a>
          {isAdmin(profile.role as Role) && (
            <a href="/admin/users" className="block rounded-[4px] px-3 py-2 hover:bg-muted">사용자 관리</a>
          )}
        </nav>
        <form action={logout} className="mt-6"><Button variant="outline" className="w-full">로그아웃</Button></form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
