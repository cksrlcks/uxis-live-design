import { Badge } from "@/shared/ui/badge";
import { providerLabel } from "../lib/provider-label";
import type { AuthProvider } from "../model/types";

// 사용자가 연결한 가입수단을 뱃지로 나열한다. 둘 다 연결했으면 뱃지 2개,
// 하나도 없으면(데이터 이상) muted "—". provider별 색으로 구분한다.
const VARIANT: Record<string, "info" | "neutral"> = {
  google: "info",
  email: "neutral",
};

export function ProviderBadges({ providers }: { providers: AuthProvider[] }) {
  if (providers.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {providers.map((provider) => (
        <Badge key={provider} variant={VARIANT[provider] ?? "outline"}>
          {providerLabel(provider)}
        </Badge>
      ))}
    </div>
  );
}
