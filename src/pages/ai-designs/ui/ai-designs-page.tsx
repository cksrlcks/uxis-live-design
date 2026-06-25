"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ExternalLink, RotateCw, Trash2, Loader2 } from "lucide-react";
import { PageHeader } from "@/widgets/studio-shell";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { aiDesignQueries } from "@/entities/ai-design";
import { useDeleteAiDesign, useRetryAiDesign } from "@/entities/ai-design/api/use-ai-design-mutations";
import { CreateAiDesignModal } from "./create-ai-design-modal";

const PAGE_TYPE_LABEL: Record<string, string> = { main: "메인", dashboard: "대시보드", subpage: "서브페이지" };

export function AiDesignsPage() {
  const { data, isPending, isError } = useQuery(aiDesignQueries.list());
  const del = useDeleteAiDesign();
  const retry = useRetryAiDesign();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="AI 시안 생성"
        description="요구사항을 입력하면 AI가 참고 시안을 바탕으로 HTML 시안을 생성합니다."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus />
            생성하기
          </Button>
        }
      />

      {isPending && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}
      {isError && <p className="text-destructive text-sm">목록을 불러오지 못했습니다.</p>}
      {data && data.length === 0 && (
        <p className="text-muted-foreground text-sm">아직 생성한 시안이 없습니다. &apos;생성하기&apos;로 시작하세요.</p>
      )}

      {data && data.length > 0 && (
        <ul className="divide-border divide-y rounded-lg border">
          {data.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{d.title}</span>
                  <Badge variant="outline">{PAGE_TYPE_LABEL[d.pageType] ?? d.pageType}</Badge>
                  {d.status === "working" && (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                      <Loader2 className="size-3 animate-spin" /> 작업중
                    </span>
                  )}
                  {d.status === "failed" && <span className="text-destructive text-xs">실패</span>}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {new Date(d.createdAt).toLocaleString("ko-KR")}
                  {d.status === "failed" && d.errorMessage ? ` · ${d.errorMessage}` : ""}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {d.status === "done" && d.hasHtml && (
                  <a
                    href={`/studio/ai-designs/${d.id}/raw`}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    <ExternalLink />
                    뷰어 열기
                  </a>
                )}
                {d.status === "failed" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={retry.isPending}
                    onClick={() =>
                      retry.mutate(d.id, {
                        onSuccess: () => toast.success("다시 생성을 시작했습니다"),
                        onError: () => toast.error("재시도에 실패했습니다"),
                      })
                    }
                  >
                    <RotateCw />
                    재시도
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={del.isPending}
                  aria-label="삭제"
                  onClick={() => {
                    if (!confirm("이 시안을 삭제할까요?")) return;
                    del.mutate(d.id, {
                      onSuccess: () => toast.success("삭제했습니다"),
                      onError: () => toast.error("삭제에 실패했습니다"),
                    });
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateAiDesignModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
