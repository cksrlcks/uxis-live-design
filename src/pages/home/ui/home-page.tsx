import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/features/auth";
import { getProfile } from "@/shared/auth/guards.server";
import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { PoweredBy } from "@/shared/ui/powered-by";

export async function HomePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnTo=/");

  return (
    <div className="bg-dot-grid flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-10">
      <Card className="w-full max-w-sm border-0 p-8 shadow-lg ring-0">
        <div className="flex w-full flex-col gap-2">
          <Link
            href="/studio"
            className={cn(
              buttonVariants({ variant: "default" }),
              "h-12 w-full rounded-lg text-base font-semibold",
            )}
          >
          COVA 스튜디오 가기
          </Link>
          <div className="mt-2 flex items-center justify-center gap-3 pt-2 text-sm">
            <Link
              href="/me"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              마이페이지
            </Link>
            <span className="bg-border h-3 w-px" aria-hidden="true" />
            <LogoutButton
              variant="link"
              className="text-muted-foreground hover:text-foreground h-auto p-0 text-sm font-normal hover:no-underline"
            >
              로그아웃
            </LogoutButton>
          </div>
        </div>
      </Card>
      <PoweredBy />
    </div>
  );
}
