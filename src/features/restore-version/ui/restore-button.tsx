"use client";

import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { useRestoreVersion } from "../api/use-restore-version";

export function RestoreButton({
  proposalId,
  variantId,
  versionId,
  isCurrent,
}: {
  proposalId: string;
  variantId: string;
  versionId: string;
  isCurrent: boolean;
}) {
  const restore = useRestoreVersion(proposalId, variantId);
  if (isCurrent) return <span className="text-muted-foreground text-xs">현재 버전</span>;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={restore.isPending}
      onClick={() =>
        restore.mutate(versionId, {
          onSuccess: () => toast.success("복원했습니다"),
          onError: (e) => toast.error(e instanceof Error ? e.message : "복원에 실패했습니다"),
        })
      }
    >
      복원
    </Button>
  );
}
