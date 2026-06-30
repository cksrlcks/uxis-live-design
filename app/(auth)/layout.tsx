import type { ReactNode } from "react";
import { AuthAura } from "@/features/auth";

// (auth) 그룹 공유 layout. layout은 형제 라우트(login↔signup↔forgot↔reset) 이동
// 시 리마운트되지 않으므로, 회전 글로우 배경(AuthAura)을 여기서 한 번만 깔면
// 페이지 이동마다 auth-orbit 애니메이션이 리셋되지 않고 계속 돈다.
export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuthAura />
      {children}
    </div>
  );
}
