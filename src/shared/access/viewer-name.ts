// 로그인 사용자(role 무관)의 표시명. 비로그인=null. 핀 authorName 폴백과 동일 규칙.
export function deriveViewerName(
  profile: { displayName: string | null; email: string } | null,
): string | null {
  if (!profile) return null;
  const name = profile.displayName ?? profile.email.split("@")[0];
  return name && name.length > 0 ? name : null;
}
