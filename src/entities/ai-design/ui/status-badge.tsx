import { Loader2 } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { AI_DESIGN_STATUS_LABELS, type AiDesignStatus } from "../model/constants";

// AI 시안 상태 배지 — 목록·상세에서 공통으로 쓴다.
// failed일 때 errorMessage를 title(툴팁)로 노출한다.
export function AiDesignStatusBadge({
  status,
  errorMessage,
}: {
  status: AiDesignStatus;
  errorMessage?: string | null;
}) {
  if (status === "working") {
    return (
      <Badge variant="neutral">
        <Loader2 className="animate-spin" />
        {AI_DESIGN_STATUS_LABELS.working}
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="error" title={errorMessage ?? undefined}>
        {AI_DESIGN_STATUS_LABELS.failed}
      </Badge>
    );
  }
  return <Badge variant="success">{AI_DESIGN_STATUS_LABELS.done}</Badge>;
}
