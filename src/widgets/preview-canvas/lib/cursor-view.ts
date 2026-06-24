// 커서 발신자가 보고 있는 화면(안+버전)을 식별하는 보기 키와, 수신자가 같은 화면을
// 보는지 판정하는 순수 헬퍼. 어느 한쪽 정보가 없으면(구버전 payload·컨텍스트 부재)
// 같은 화면으로 간주해 기존처럼 선명하게 표시한다(안전한 폴백).
export function viewKey(variantId: string, versionId: string): string {
  return `${variantId}:${versionId}`;
}

export function isSameView(mine: string | undefined, theirs: string | undefined): boolean {
  if (!mine || !theirs) return true;
  return mine === theirs;
}
