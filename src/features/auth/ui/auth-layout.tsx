import Image from "next/image";
import type { ReactNode } from "react";
import DarkVeil from "@/shared/darkveil-lazy";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-12">
      {/* 전체 배경 — DarkVeil 애니메이션 (로드 전 빈 화면 방지용 기본색 깔아둠) */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-black">
        {/* 해상도 무관하게 베일이 화면 중간까지만 내려온 느낌이 나도록 아래로 갈수록 검정으로 페이드 */}
        <div className="absolute inset-0 mask-[linear-gradient(to_bottom,#000_0%,#000_25%,transparent_60%)]">
          <DarkVeil
            hueShift={25}
            noiseIntensity={0}
            scanlineIntensity={0.45}
            speed={1}
            scanlineFrequency={0}
            warpAmount={0}
            resolutionScale={1}
          />
        </div>
      </div>
      {/* 상단: 로고 + 설명 (가운데) */}
      <div className="mb-16 max-w-md break-keep text-center">
        <Image
          src="/logo.svg"
          alt="cova"
          width={140}
          height={30}
          draggable={false}
          className="mx-auto select-none brightness-0 invert"
        />
        <p className="mt-6 text-base text-white/50">
          시안을 함께 확인하고 
          의견을 주고받는 프리뷰 협업 공간
        </p>
      </div>

      {/* 폼 영역 — 카드 배경 없이 다크 테마 */}
      <div className="dark text-foreground relative w-full max-w-md">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <div className="text-muted-foreground text-sm">{subtitle}</div>}
        </div>

        <div className="mt-8">{children}</div>

        <div className="text-muted-foreground mt-6 text-center text-sm">{footer}</div>

        {/* 폼 하단 copyright */}
        <p className="mt-10 text-center text-xs text-white/40">© 2026 UXIS Co.</p>
      </div>
    </div>
  );
}
