"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useUpdateSettings, useDeleteProposal } from "../api/use-edit-settings";

const passwordSchema = z.object({
  password: z.string().min(4, "비밀번호는 4자 이상이어야 합니다"),
});
type PasswordValues = z.infer<typeof passwordSchema>;

export function ProposalSettings({
  proposalId,
  visibility,
  hasPassword,
}: {
  proposalId: string;
  visibility: string;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const updateSettings = useUpdateSettings(proposalId);
  const deleteProposal = useDeleteProposal(proposalId);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const pending = updateSettings.isPending || deleteProposal.isPending;

  function change(input: Parameters<typeof updateSettings.mutate>[0]) {
    setError(null);
    updateSettings.mutate(input, { onError: () => setError("변경에 실패했습니다.") });
  }

  function onSetPassword({ password }: PasswordValues) {
    change({ password });
    reset();
  }

  function onDelete() {
    if (!confirm("이 시안을 삭제할까요? 모든 버전과 이미지가 사라집니다.")) return;
    setError(null);
    deleteProposal.mutate(undefined, {
      onSuccess: () => router.push("/dashboard/proposals"),
      onError: () => setError("삭제에 실패했습니다."),
    });
  }

  return (
    <div className="border-border space-y-4 rounded-[8px] border p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm">공개 상태:</span>
        <Button
          size="sm"
          variant={visibility === "private" ? "default" : "outline"}
          disabled={pending}
          onClick={() => change({ visibility: "private" })}
        >
          비공개
        </Button>
        <Button
          size="sm"
          variant={visibility === "public" ? "default" : "outline"}
          disabled={pending}
          onClick={() => change({ visibility: "public" })}
        >
          공개
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSetPassword)} className="space-y-2">
        <Label htmlFor="password">
          접근 비밀번호{" "}
          {hasPassword && <span className="text-muted-foreground text-xs">(설정됨)</span>}
        </Label>
        <div className="flex gap-2">
          <Input id="password" type="password" placeholder="4자 이상" {...register("password")} />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            설정/변경
          </Button>
          {hasPassword && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => change({ password: null })}
            >
              비번 해제
            </Button>
          )}
        </div>
        {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
        <p className="text-muted-foreground text-xs">비밀번호는 공개 시안에만 적용됩니다.</p>
      </form>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="border-border border-t pt-4">
        <Button variant="destructive" size="sm" disabled={pending} onClick={onDelete}>
          시안 삭제
        </Button>
      </div>
    </div>
  );
}
