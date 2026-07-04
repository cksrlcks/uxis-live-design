"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "@/widgets/studio-shell";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/skeleton";
import { useConfirm } from "@/shared/ui/confirm";
import { apiTokenQueries, useRegenerateToken, useRevokeToken } from "@/entities/api-token";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function ApiTokensPage() {
  const { data, isPending, isError } = useQuery(apiTokenQueries.mine());
  const regenerate = useRegenerateToken();
  const revoke = useRevokeToken();
  const confirm = useConfirm();
  const busy = regenerate.isPending || revoke.isPending;

  async function onCopy(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      toast.success("토큰을 복사했습니다");
    } catch {
      toast.error("복사에 실패했습니다");
    }
  }

  function issue() {
    regenerate.mutate(undefined, {
      onSuccess: () => toast.success("토큰을 발급했습니다"),
      onError: () => toast.error("발급에 실패했습니다"),
    });
  }

  async function onRegenerate() {
    const ok = await confirm({
      title: "토큰을 재발급할까요?",
      description: "기존 토큰은 즉시 무효화됩니다. 스킬 설정의 토큰도 새 값으로 바꿔야 합니다.",
      confirmLabel: "재발급",
    });
    if (!ok) return;
    regenerate.mutate(undefined, {
      onSuccess: () => toast.success("토큰을 재발급했습니다"),
      onError: () => toast.error("재발급에 실패했습니다"),
    });
  }

  async function onRevoke() {
    const ok = await confirm({
      title: "토큰을 폐기할까요?",
      description: "이 토큰으로는 더 이상 저장할 수 없게 됩니다.",
      confirmLabel: "폐기",
    });
    if (!ok) return;
    revoke.mutate(undefined, {
      onSuccess: () => toast.success("토큰을 폐기했습니다"),
      onError: () => toast.error("폐기에 실패했습니다"),
    });
  }

  return (
    <div>
      <PageHeader
        title="API 토큰"
        description="Claude Code 스킬(cova-make-design)이 시안을 실서비스에 저장할 때 쓰는 내 개인 토큰입니다."
      />

      {isPending ? (
        <Card>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent>
            <p className="text-body text-destructive">토큰을 불러오지 못했습니다.</p>
          </CardContent>
        </Card>
      ) : data ? (
        <Card>
          <CardHeader>
            <CardTitle>내 토큰</CardTitle>
            <CardDescription>
              스킬 설정에서 <code className="bg-muted rounded px-1 py-0.5 text-xs">COVA_DESIGN_TOKEN</code> 값으로
              사용하세요. 본인만 볼 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                readOnly
                value={data.token}
                className="font-mono"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button variant="outline" className="shrink-0" onClick={() => onCopy(data.token)}>
                <Copy />
                복사
              </Button>
            </div>
            <p className="text-caption text-muted-foreground">
              발급 {formatDate(data.createdAt)}
              {data.lastUsedAt ? ` · 마지막 사용 ${formatDate(data.lastUsedAt)}` : " · 미사용"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onRegenerate} disabled={busy}>
                <RefreshCw />
                재발급
              </Button>
              <Button variant="ghost" onClick={onRevoke} disabled={busy}>
                <Trash2 />
                폐기
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <EmptyState
              icon={<KeyRound />}
              title="아직 토큰이 없습니다"
              description="발급하면 스킬에서 시안을 실서비스에 저장할 수 있습니다."
              action={
                <Button onClick={issue} disabled={busy}>
                  <KeyRound />
                  토큰 발급
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
