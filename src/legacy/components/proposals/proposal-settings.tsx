"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function ProposalSettings({
  proposalId,
  visibility,
  hasPassword,
}: { proposalId: string; visibility: string; hasPassword: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function patch(payload: Record<string, unknown>) {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) setError((await res.json()).error ?? "변경 실패");
      else {
        queryClient.invalidateQueries({ queryKey: proposalQueries.detail(proposalId).queryKey });
        queryClient.invalidateQueries({ queryKey: proposalQueries.lists() });
      }
    });
  }

  function onSetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pw = (e.currentTarget.elements.namedItem("password") as HTMLInputElement).value;
    patch({ password: pw });
    e.currentTarget.reset();
  }

  function onDelete() {
    if (!confirm("이 시안을 삭제할까요? 모든 버전과 이미지가 사라집니다.")) return;
    start(async () => {
      const res = await fetch(`/api/proposals/${proposalId}`, { method: "DELETE" });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: proposalQueries.lists() });
        router.push("/dashboard/proposals");
      }
      else setError((await res.json()).error ?? "삭제 실패");
    });
  }

  return (
    <div className="space-y-4 rounded-[8px] border border-border p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm">공개 상태:</span>
        <Button size="sm" variant={visibility === "private" ? "default" : "outline"} disabled={pending}
          onClick={() => patch({ visibility: "private" })}>비공개</Button>
        <Button size="sm" variant={visibility === "public" ? "default" : "outline"} disabled={pending}
          onClick={() => patch({ visibility: "public" })}>공개</Button>
      </div>

      <form onSubmit={onSetPassword} className="space-y-2">
        <Label htmlFor="password">접근 비밀번호 {hasPassword && <span className="text-xs text-muted-foreground">(설정됨)</span>}</Label>
        <div className="flex gap-2">
          <Input id="password" name="password" type="password" minLength={4} placeholder="4자 이상" />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>설정/변경</Button>
          {hasPassword && (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => patch({ password: null })}>비번 해제</Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">비밀번호는 공개 시안에만 적용됩니다.</p>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="border-t border-border pt-4">
        <Button variant="destructive" size="sm" disabled={pending} onClick={onDelete}>시안 삭제</Button>
      </div>
    </div>
  );
}
