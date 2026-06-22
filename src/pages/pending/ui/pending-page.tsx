import Link from "next/link";
import { Clock } from "lucide-react";
import { LogoutButton } from "@/features/auth";
import { buttonVariants } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { PoweredBy } from "@/shared/ui/powered-by";

export function PendingPage() {
  return (
    <div className="bg-dot-grid flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-10">
      <Card className="w-full max-w-sm border-0 p-8 shadow-lg ring-0">
        <div className="flex flex-col items-center text-center">
          <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
            <Clock className="size-5" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-lg font-bold tracking-tight">승인 대기 중</h1>
          <p className="text-muted-foreground mt-1.5 text-sm break-keep">
            관리자 승인 후 시안을 관리할 수 있습니다. 승인이 완료되면 바로 이용하실 수 있어요.
          </p>
        </div>
        <div>
          <LogoutButton
            variant="default"
            className="mt-2 h-12 w-full rounded-lg text-base font-semibold"
          />
          <Link
            href="/"
            className={buttonVariants({
              variant: "outline",
              className: "h-12 w-full rounded-lg text-base font-semibold",
            })}
          >
            처음 화면으로 가기
          </Link>
        </div>
      </Card>
      <PoweredBy />
    </div>
  );
}
