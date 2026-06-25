import Link from "next/link";
import { ChangePasswordDialog } from "@/features/auth";
import { Card } from "@/shared/ui/card";
import { PoweredBy } from "@/shared/ui/powered-by";
import { MyPage } from "./my-page";

type AccountPageProps = {
  displayName: string | null;
  email: string;
  createdAt: Date | string | null;
  isOAuthUser?: boolean;
};

// 스튜디오 셸 밖의 독립 마이페이지 — 뷰어 첫화면에서 진입.
// 홈·pending과 동일한 dot-grid 캔버스 + 중앙 카드 패턴으로 맞춘다.
export function AccountPage({ isOAuthUser, ...props }: AccountPageProps) {
  return (
    <div className="bg-dot-grid flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-10">
      <Card className="w-full max-w-sm border-0 p-8 shadow-lg ring-0">
        <MyPage {...props} />

        <ChangePasswordDialog isOAuthUser={isOAuthUser} />

        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground block text-center text-sm transition-colors"
        >
          홈으로 돌아가기
        </Link>
      </Card>

      <PoweredBy />
    </div>
  );
}
