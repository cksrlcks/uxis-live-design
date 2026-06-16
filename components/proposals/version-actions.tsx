"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function RestoreButton({ proposalId, versionId, isCurrent }: { proposalId: string; versionId: string; isCurrent: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (isCurrent) return <span className="text-xs text-muted-foreground">현재 버전</span>;
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() =>
      start(async () => {
        const res = await fetch(`/api/proposals/${proposalId}/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId }),
        });
        if (res.ok) router.refresh();
      })
    }>복원</Button>
  );
}
