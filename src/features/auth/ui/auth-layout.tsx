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
    <div className="flex min-h-screen">
      {/* 왼쪽: 폼 영역 — 모바일은 전체 폭, lg 이상에서 절반 */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-12">
        <div className="text-card-foreground mx-auto w-full max-w-sm">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <div className="text-muted-foreground text-sm">{subtitle}</div>
          </div>

          <div className="mt-8">{children}</div>

          <div className="text-muted-foreground mt-6 text-sm">{footer}</div>
        </div>
      </div>

      {/* 오른쪽: 블루 그라디언트 브랜드 패널 — 모바일에서는 숨김 */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:w-1/2 lg:items-center lg:px-16"
        style={{
          backgroundColor: "#0a3aa8",
          backgroundImage:
            "radial-gradient(at 22% 20%, #3b89ff 0, transparent 55%), radial-gradient(at 80% 82%, #082567 0, transparent 55%)",
        }}
      >
        <div className="max-w-md break-keep">
          <Image
            src="/logo.svg"
            alt="cova"
            width={120}
            height={30}
            className="brightness-0 invert"
          />
          <p className="mt-6 text-base leading-relaxed text-white/85">
            COVA는 디자이너와 클라이언트가 시안을 한곳에서 함께 확인하고 의견을 주고받는 프리뷰 협업
            공간입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
