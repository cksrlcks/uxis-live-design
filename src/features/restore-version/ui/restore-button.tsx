"use client";

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
      onClick={() => restore.mutate(versionId)}
    >
      복원
    </Button>
  );
}
