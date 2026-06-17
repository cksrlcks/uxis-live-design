export const MAX_CHAT_BODY = 2000;

// 클라이언트가 보낸 본문을 trim한 뒤 1..MAX_CHAT_BODY 글자면 그 문자열을, 아니면 null을 반환.
export function validateChatBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const body = raw.trim();
  if (body.length === 0 || body.length > MAX_CHAT_BODY) return null;
  return body;
}
