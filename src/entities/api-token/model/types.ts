// 현재 사용자의 API 토큰(없으면 null). 열람 가능한 평문 토큰.
export type MyToken = {
  token: string;
  createdAt: string;
  lastUsedAt: string | null;
} | null;
