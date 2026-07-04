"use client";

import { useState } from "react";
import { http } from "@/shared/api/http";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";

type State = "pending" | "approved" | "expired" | "not-editor";

// CLI(스킬) 업로드 권한 동의 화면. OAuth 동의처럼 단독 페이지로 렌더된다.
export function CliAuthPage({ authId, state }: { authId: string; state: State }) {
  const [view, setView] = useState<State | "denied-done">(state);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function act(method: "POST" | "DELETE") {
    setBusy(true);
    setError(false);
    try {
      await http<void>(`/api/admin/cli-auth/${authId}`, { method });
      setView(method === "POST" ? "approved" : "denied-done");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const body =
    view === "approved" ? (
      <CardContent className="space-y-2">
        <p className="text-body">승인했습니다. 터미널(Claude Code)로 돌아가면 업로드가 이어집니다.</p>
        <p className="text-caption text-muted-foreground">이 창은 닫아도 됩니다.</p>
      </CardContent>
    ) : view === "denied-done" ? (
      <CardContent>
        <p className="text-body">요청을 거부했습니다. 이 창은 닫아도 됩니다.</p>
      </CardContent>
    ) : view === "expired" ? (
      <CardContent>
        <p className="text-body">만료되었거나 이미 처리된 요청입니다. 터미널에서 다시 시도해주세요.</p>
      </CardContent>
    ) : view === "not-editor" ? (
      <CardContent>
        <p className="text-body">에디터 권한이 필요합니다. 관리자에게 권한을 요청해주세요.</p>
      </CardContent>
    ) : (
      <CardContent className="space-y-4">
        <p className="text-body">
          승인하면 이 컴퓨터의 스킬이 내 계정으로 시안을 업로드할 수 있습니다. 직접 실행한
          요청이 아니라면 거부하세요.
        </p>
        {error && <p className="text-body text-destructive">처리에 실패했습니다. 다시 시도해주세요.</p>}
        <div className="flex gap-2">
          <Button onClick={() => act("POST")} disabled={busy}>
            승인
          </Button>
          <Button variant="outline" onClick={() => act("DELETE")} disabled={busy}>
            거부
          </Button>
        </div>
      </CardContent>
    );

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>CLI 업로드 권한 요청</CardTitle>
          <CardDescription>
            cova-make-design 스킬이 시안 업로드 권한을 요청합니다.
          </CardDescription>
        </CardHeader>
        {body}
      </Card>
    </main>
  );
}
