import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

// 검은 배경 위에서 입력창·구글 버튼 보더(둘 다 --input 토큰 사용)가 너무 흐려
// 인증 폼에 한해 밝은 값으로 덮는다. .dark 토큰은 unlayered 라 Tailwind 유틸리티
// (layered)로는 못 이기므로 인라인 스타일로 확실히 우선시킨다. 전역 .dark 를
// 바꾸지 않아 /me·/pending·뷰어 다이얼로그 등 다른 다크 표면에는 영향이 없다.
const authFormVars = {
  "--input": "oklch(1 0 0 / 30%)",
  "--border": "oklch(1 0 0 / 20%)",
} as CSSProperties;

// 회전 글로우 배경(AuthAura)은 (auth) 라우트 그룹의 공유 layout에서 한 번만
// 렌더한다 — 페이지마다 따로 두면 로그인↔회원가입 이동 때 리마운트되며 회전이 리셋된다.

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden px-6 pt-36 pb-10">
      {/* 배경(AuthAura)은 (auth) 그룹 공유 layout이 깐다 — 여기선 그 위 콘텐츠만 */}
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
        <p className="mt-4 text-sm text-white/70 tracking-tight">
          실시간 시안 커뮤니케이션
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
