import type { ReactNode } from "react";
import { type Role } from "@/shared/auth/roles";
import { StudioSidebar } from "./studio-sidebar";
import { StudioTopbar } from "./studio-topbar";

type StudioShellProps = {
  displayName: string | null;
  email: string;
  role: Role;
  children: ReactNode;
};

export function StudioShell({ displayName, email, role, children }: StudioShellProps) {
  return (
    <div className="bg-muted text-foreground flex min-h-screen">
      <StudioSidebar displayName={displayName} email={email} role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <StudioTopbar />
        <main className="flex-1 px-8 py-7">{children}</main>
      </div>
    </div>
  );
}
