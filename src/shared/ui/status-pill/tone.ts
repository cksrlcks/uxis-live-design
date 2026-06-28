export type StatusTone = "info" | "success" | "warning" | "danger" | "neutral" | "role";
export type StatusBadgeVariant = "info" | "success" | "warning" | "error" | "neutral" | "purple";

/** 도메인 의미(tone)를 Badge 의 내부 variant 이름으로 매핑한다. */
export function statusPillVariant(tone: StatusTone): StatusBadgeVariant {
  switch (tone) {
    case "danger":
      return "error";
    case "role":
      return "purple";
    default:
      return tone;
  }
}
