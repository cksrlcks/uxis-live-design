// 채팅 메시지의 클라이언트/전송 표현. DB의 ChatMessage(createdAt: Date)와 달리
// createdAt은 ISO 문자열 — 서버 주입(RSC)·broadcast(JSON)·클라 상태가 같은 모양이 된다.
export type ChatMessageDTO = {
  id: string;
  authorId: string | null; // 로그인 작성자의 프로필 id(소유권 기준). 게스트는 null
  authorName: string;
  authorColor: string;
  body: string; // 삭제된 메시지면 빈 문자열(원문은 서버에서 노출하지 않음)
  createdAt: string; // ISO 8601
  editedAt: string | null; // 수정 시각 — 있으면 "수정됨" 표시
  deletedAt: string | null; // 소프트 삭제 시각 — 있으면 "삭제된 메시지" 표시
};
