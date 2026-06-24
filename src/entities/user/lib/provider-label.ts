import type { AuthProvider } from "../model/types";

// provider 원문 → 사람이 읽는 한글 라벨. 매핑에 없는 값은 원문 그대로 반환해
// 미지 provider(향후 Apple/Kakao 등)도 깨지지 않게 보존한다.
const LABELS: Record<string, string> = {
  email: "이메일",
  google: "구글",
};

export function providerLabel(provider: AuthProvider): string {
  return LABELS[provider] ?? provider;
}
