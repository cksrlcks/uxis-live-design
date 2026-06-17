import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/legacy/lib/auth/session";
import { isEditor, isAdmin, type Role } from "@/legacy/lib/auth/roles";
import { logout } from "../(auth)/actions";
import { Button } from "@/legacy/components/ui/button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!isEditor(profile.role as Role)) redirect("/pending");

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r border-border p-4">
        <div className="mb-6 text-sm font-medium tracking-tight">uxis live design</div>
        <nav className="space-y-1 text-sm">
          <Link href="/dashboard/proposals" className="block rounded-[4px] px-3 py-2 hover:bg-muted">시안</Link>
          {isAdmin(profile.role as Role) && (
            <Link href="/admin/users" className="block rounded-[4px] px-3 py-2 hover:bg-muted">사용자 관리</Link>
          )}
        </nav>
        <form action={logout} className="mt-6"><Button type="submit" variant="outline" className="w-full">로그아웃</Button></form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
