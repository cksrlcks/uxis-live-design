import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import Aurora from "@/shared/aurora-lazy";

// 검은 배경 위에서 입력창·구글 버튼 보더(둘 다 --input 토큰 사용)가 너무 흐려
// 인증 폼에 한해 밝은 값으로 덮는다. .dark 토큰은 unlayered 라 Tailwind 유틸리티
// (layered)로는 못 이기므로 인라인 스타일로 확실히 우선시킨다. 전역 .dark 를
// 바꾸지 않아 /me·/pending·뷰어 다이얼로그 등 다른 다크 표면에는 영향이 없다.
const authFormVars = {
  "--input": "oklch(1 0 0 / 30%)",
  "--border": "oklch(1 0 0 / 20%)",
} as CSSProperties;

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden px-6 py-[12vh]">
      {/* 전체 배경 — Aurora 애니메이션 (로드 전 빈 화면 방지용 기본색 깔아둠) */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-black">
        <div className="absolute inset-0">
          <Aurora colorStops={["#1e40af", "#020b80", "#0277a8"]} amplitude={0.4} blend={1} />
        </div>
      </div>
      {/* 상단: 로고 + 설명 (가운데) */}
      <div className="mb-12 max-w-md text-center break-keep">
        <Image
          src="/logo.svg"
          alt="cova"
          width={120}
          height={30}
          draggable={false}
          className="mx-auto brightness-0 invert select-none"
        />
        <p className="mt-6 text-sm text-white/70 tracking-tight">
          시안을 함께 확인하고 의견을 주고받는 프리뷰 협업 공간
        </p>
      </div>

      {/* 폼 영역 — 카드 배경 없이 다크 테마 */}
      <div className="dark text-foreground relative w-full max-w-md" style={authFormVars}>
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <div className="text-muted-foreground text-sm">{subtitle}</div>}
        </div>

        <div className="mt-6">{children}</div>

        <div className="text-muted-foreground mt-6 text-center text-sm">{footer}</div>

        {/* 폼 하단 copyright */}
        <p className="mt-10 text-center text-xs text-white/40">© 2026 UXIS Co.</p>
      </div>
    </div>
  );
}
