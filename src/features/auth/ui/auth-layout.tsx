import Image from "next/image";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-end justify-center sm:items-center">
      <div className="text-card-foreground w-full max-w-md rounded-t-3xl px-6 py-6">
        <div className="mb-8 space-y-4 border-b border-gray-200 pb-5">
          <Image src="/logo.svg" alt="cova" width={77} height={19} />
          <div className="text-sm tracking-tight break-keep opacity-76">
            COVA는 디자이너와 클라이언트가 시안을 한곳에서 함께 확인하고<br />
            의견을 주고받는 프리뷰 협업 공간입니다.
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <div className="text-sm opacity-76">{subtitle}</div>
        </div>

        <div className="mt-6">{children}</div>

        <div className="text-muted-foreground mt-6 text-center text-sm">{footer}</div>
      </div>
    </div>
  );
}
