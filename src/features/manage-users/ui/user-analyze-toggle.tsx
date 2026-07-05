"use client";

import { toast } from "sonner";
import { Switch } from "@/shared/ui/switch";
import { useUpdateUserAnalyze } from "../api/use-update-user-analyze";

export function UserAnalyzeToggle({ id, allowAnalyze }: { id: string; allowAnalyze: boolean }) {
  const update = useUpdateUserAnalyze();

  function handleChange(next: boolean) {
    update.mutate(
      { id, allowAnalyze: next },
      {
        onSuccess: () => toast.success(next ? "분석 권한을 부여했습니다" : "분석 권한을 해제했습니다"),
        onError: () => toast.error("분석 권한 변경에 실패했습니다"),
      },
    );
  }

  return (
    <Switch checked={allowAnalyze} onCheckedChange={handleChange} disabled={update.isPending} />
  );
}
