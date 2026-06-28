import { Mail } from "lucide-react";
import { providerLabel } from "../lib/provider-label";
import type { AuthProvider } from "../model/types";

// 사용자가 연결한 가입수단을 아이콘으로 나열한다. 구글은 브랜드 컬러 SVG,
// 이메일은 lucide Mail. 미지 provider는 라벨 텍스트로 폴백한다(향후 Apple/Kakao 등).
// hover/스크린리더용 라벨은 title·aria-label로 노출한다.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

// 흰 배경 + 회색 테두리 원형 안에 아이콘을 담는 공통 칩.
const chip =
  "inline-flex size-8 items-center justify-center rounded-full border border-border bg-white";

export function ProviderIcons({ providers }: { providers: AuthProvider[] }) {
  if (providers.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {providers.map((provider) => {
        const label = providerLabel(provider);
        if (provider === "google") {
          return (
            <span key={provider} title={label} aria-label={label} className={chip}>
              <GoogleIcon className="size-4" />
            </span>
          );
        }
        if (provider === "email") {
          return (
            <span key={provider} title={label} aria-label={label} className={chip}>
              <Mail className="size-4 text-gray-600" aria-hidden="true" />
            </span>
          );
        }
        return (
          <span key={provider} className="text-muted-foreground text-xs">
            {label}
          </span>
        );
      })}
    </div>
  );
}
