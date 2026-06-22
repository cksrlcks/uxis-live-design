// 스트로크의 클라이언트/전송 표현(createdAt ISO 문자열 — RSC·broadcast·상태 동일 모양).
export type StrokePoint = { x: number; y: number };

export type StrokeDTO = {
  id: string;
  variantId: string;
  versionId: string;
  pageOrder: number;
  points: StrokePoint[];
  color: string;
  width: number;
  authorId: string | null;
  authorName: string;
  authorColor: string;
  createdAt: string; // ISO 8601
};

// 캔버스 화이트보드 기능 컨텍스트. 게스트도 그릴 수 있어 viewerId는 불필요.
export type WhiteboardContext = {
  publicId: string;
  variantId: string;
  versionId: string;
};
