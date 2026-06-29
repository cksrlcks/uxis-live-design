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

// 피그마에서 타원들을 블러 + screen 블렌드로 겹친 글로우.
// 색은 파랑/초록/보라/핑크. 45도 간격을 기준으로 회전·크기·위치·블러를
// 타원마다 살짝씩 어긋나게 줘서 기계적인 대칭을 깨고 자연스럽게 흩어 보이게 한다.
const AURA_ELLIPSES = [
  { color: "#2470FF", rotate: -5, w: 62, h: 82, x: -52, y: -47, blur: 22 },
  { color: "#2EEF8A", rotate: 48, w: 57, h: 78, x: -48, y: -53, blur: 18 },
  { color: "#5206FE", rotate: 87, w: 64, h: 84, x: -47, y: -49, blur: 24 },
  { color: "#FE06A3", rotate: 139, w: 56, h: 77, x: -51, y: -52, blur: 19 },
];

// 상단 중앙에 절반쯤 보이게 띄운 회전 글로우. 부모는 검정 배경 — screen 블렌드는
// 검정 위에서 색을 그대로 살리고 겹친 부분만 밝아져 가운데가 청록빛으로 빛난다.
function AuthAura() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-black">
      {/* 글로우 뒤에 까는 미세한 수직 그라데이션 — 위는 글로우와 어울리게 살짝
          들뜬 남색, 아래로 갈수록 순수 검정으로 떨어져 단조로운 까만 배경을 푼다. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, oklch(0.24 0.04 264) 0%, oklch(0.14 0.025 264) 35%, #000 80%)",
        }}
      />
      {/* 세트 컨테이너 — 중심을 화면 상단 모서리에 두어 아래 절반만 보이고,
          auth-orbit(rotate 프로퍼티)으로 세트 전체가 제자리에서 천천히 돈다. */}
      <div className="auth-orbit absolute top-0 left-1/2 size-100 -translate-x-1/2 -translate-y-2/3">
        {AURA_ELLIPSES.map(({ color, rotate, w, h, x, y, blur }) => (
          <div
            key={color}
            className="absolute top-1/2 left-1/2 rounded-[50%]"
            style={{
              width: `${w}%`,
              height: `${h}%`,
              backgroundColor: color,
              mixBlendMode: "screen",
              filter: `blur(${blur}px)`,
              opacity: 0.9,
              transform: `translate(${x}%, ${y}%) rotate(${rotate}deg)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden px-6 pt-36 pb-10">
      {/* 전체 배경 — 상단 중앙에서 천천히 도는 타원 글로우 */}
      <AuthAura />
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
