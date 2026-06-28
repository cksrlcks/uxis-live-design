"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { PageHeader } from "@/widgets/studio-shell";

interface Props {
  initialPrompt: string;
  // 서버 컴포넌트가 주입하는 Server Action. 내부에서 관리자 권한을 재검증한다.
  updatePrompt: (content: string) => Promise<void>;
}

export function AiDesignSettingsPage({ initialPrompt, updatePrompt }: Props) {
  const [value, setValue] = useState(initialPrompt);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await updatePrompt(value);
        toast.success("저장했습니다");
      } catch {
        toast.error("저장에 실패했습니다");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="AI 생성 설정"
        description="AI가 HTML 시안을 생성할 때 사용하는 지침입니다. 변경 즉시 다음 생성부터 반영됩니다."
        backHref="/studio/ai-designs"
        backLabel="AI 시안 목록"
      />

      <div className="space-y-3">
        <Label htmlFor="system-prompt">시스템 프롬프트</Label>
        <textarea
          id="system-prompt"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isPending}
          spellCheck={false}
          style={{ minHeight: "420px" }}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 bg-muted/50 rounded-control w-full resize-y border px-3 py-2.5 font-mono text-sm leading-relaxed outline-none focus-visible:ring-3 disabled:opacity-50"
        />
        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}
