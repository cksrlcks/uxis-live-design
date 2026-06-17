// 핀의 클라이언트/전송 표현(createdAt ISO 문자열 — RSC·broadcast·상태 동일 모양).
export type PinDTO = {
  id: string;
  variantId: string;
  versionId: string;
  pageOrder: number;
  xNorm: number;
  yNorm: number;
  authorId: string | null;
  authorName: string;
  authorColor: string;
  body: string;
  resolved: boolean;
  createdAt: string; // ISO 8601
};

// provider→PinLayer로 중계되는 실시간 이벤트.
export type PinEvent =
  | { type: "pin"; pin: PinDTO }
  | { type: "pin_updated"; pin: PinDTO }
  | { type: "pin_deleted"; id: string };

// 캔버스로 내려보내는 핀 기능 컨텍스트. viewerId=null이면 게스트(로그인 유도).
export type PinContext = {
  publicId: string;
  variantId: string;
  versionId: string;
  viewerId: string | null;
};
