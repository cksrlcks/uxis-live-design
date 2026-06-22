import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LogoutButton } from "@/features/auth";
import { type Role } from "@/shared/auth/roles";
import { PoweredBy } from "@/shared/ui/powered-by";
import { MyPage } from "./my-page";

type AccountPageProps = {
  displayName: string | null;
  email: string;
  role: Role;
  createdAt: Date | string | null;
};

// 스튜디오 셸 밖의 독립 마이페이지 — 뷰어 첫화면(최근 본 시안)에서 진입.
export function AccountPage(props: AccountPageProps) {
  return (
    <div className="bg-muted text-foreground flex min-h-screen flex-col items-center px-6 py-16">
      <div className="w-full max-w-xl">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4" />
          홈
        </Link>

        <MyPage {...props} />

        <LogoutButton variant="outline" className="mt-6 h-11 w-full rounded-lg" />

        <PoweredBy className="mt-10" />
      </div>
    </div>
  );
}
