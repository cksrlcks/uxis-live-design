// Figma 플러그인 UI는 null-origin(비보안 컨텍스트) iframe이라 crypto.randomUUID()·crypto.subtle을
// 쓸 수 없다(둘 다 보안 컨텍스트 전용). crypto.getRandomValues는 비보안 컨텍스트에서도 동작하므로
// 이걸로 페어링 키(16바이트=32 hex, uuid 수준 엔트로피)를 만든다.
export function randomKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
