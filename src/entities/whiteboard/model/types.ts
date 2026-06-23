// 스트로크의 클라이언트/전송 표현(createdAt ISO 문자열 — RSC·broadcast·상태 동일 모양).
export type StrokePoint = { x: number; y: number };

// DB 레이어 row의 jsonb 배열 원소(저장되는 한 획).
export type StoredStroke = {
  drawId: string;
  points: StrokePoint[];
  color: string;
  width: number;
};

// 렌더/전송용 평탄화 획(레이어를 펼친 것). 로그인 필수라 authorId는 non-null.
export type StrokeDTO = {
  id: string; // = stroke.drawId
  variantId: string;
  versionId: string;
  pageOrder: number;
  points: StrokePoint[];
  color: string;
  width: number;
  authorId: string;
  authorName: string;
  authorColor: string;
  createdAt: string; // ISO 8601 — 레이어 updatedAt
};

// 캔버스 화이트보드 컨텍스트. viewerId=null이면 게스트(로그인 유도).
export type WhiteboardContext = {
  publicId: string;
  variantId: string;
  versionId: string;
  viewerId: string | null;
};
