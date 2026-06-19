// 핀의 클라이언트/전송 표현(createdAt ISO 문자열 — RSC·broadcast·상태 동일 모양).
// provider→PinLayer로 중계되는 실시간 이벤트.
// 캔버스로 내려보내는 핀 기능 컨텍스트. viewerId=null이면 게스트(로그인 유도).
export type { PinDTO, PinEvent, PinContext } from "@/entities/pin";
