// 채팅 메시지의 클라이언트/전송 표현. DB의 ChatMessage(createdAt: Date)와 달리
// createdAt은 ISO 문자열 — 서버 주입(RSC)·broadcast(JSON)·클라 상태가 같은 모양이 된다.
export type ChatMessageDTO = {
  id: string;
  authorName: string;
  authorColor: string;
  body: string;
  createdAt: string; // ISO 8601
};
