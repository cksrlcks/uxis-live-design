import type { ChatMessageDTO } from "../model/types";

// id 기준 upsert: 같은 id가 있으면 교체(수정/삭제 반영), 없으면 끝에 추가(신규).
// 전송 onSuccess, broadcast bridge, 수정/삭제 mutation이 모두 이 규칙을 공유한다.
export function upsertChatMessage(
  prev: ChatMessageDTO[] | undefined,
  message: ChatMessageDTO,
): ChatMessageDTO[] {
  if (!prev) return [message];
  const idx = prev.findIndex((m) => m.id === message.id);
  if (idx === -1) return [...prev, message];
  const next = prev.slice();
  next[idx] = message;
  return next;
}
