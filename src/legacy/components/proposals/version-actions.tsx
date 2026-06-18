"use client";
import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { Button } from "@/shared/ui/button";

export function RestoreButton({ proposalId, variantId, versionId, isCurrent }: {
  proposalId: string; variantId: string; versionId: string; isCurrent: boolean;
}) {
  const queryClient = useQueryClient();
  const [pending, start] = useTransition();
  if (isCurrent) return <span className="text-xs text-muted-foreground">현재 버전</span>;
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() =>
      start(async () => {
        const res = await fetch(`/api/proposals/${proposalId}/variants/${variantId}/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId }),
        });
        if (res.ok)
          queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey });
      })
    }>복원</Button>
  );
}
