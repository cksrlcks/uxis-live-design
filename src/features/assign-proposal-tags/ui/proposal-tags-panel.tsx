"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { tagQueries } from "@/entities/tag";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useSaveProposalTags } from "../api/use-save-proposal-tags";

export function ProposalTagsPanel({ proposalId }: { proposalId: string }) {
  const taxonomy = useQuery(tagQueries.taxonomy());
  const current = useQuery(tagQueries.proposal(proposalId));
  const save = useSaveProposalTags(proposalId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 서버 선택값이 로드/갱신되면 로컬 선택 상태를 동기화한다.
  // 단, 사용자가 편집 중(dirty)일 때는 덮어쓰지 않는다 — 백그라운드 refetch가
  // 미저장 토글을 날리지 않도록. (저장 후엔 selected==서버값이라 정상 동기화된다.)
  useEffect(() => {
    if (!current.data) return;
    const base = new Set(current.data.optionIds);
    const isDirty =
      selected.size !== base.size || [...selected].some((id) => !base.has(id));
    if (!isDirty) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: server data loaded async; dirty가 아닐 때만 동기화
      setSelected(base);
    }
    // selected는 의도적으로 dep에서 제외 — 초기 로드/저장 후 동기화 전용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.data]);

  if (taxonomy.isPending || current.isPending) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (taxonomy.isError || current.isError || !current.data) {
    return <p className="text-destructive text-sm">태그 정보를 불러오지 못했습니다.</p>;
  }
  if (taxonomy.data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        등록된 태그 분류가 없습니다. 관리자에게 문의하세요.
      </p>
    );
  }

  const baseline = new Set(current.data.optionIds);
  const dirty =
    selected.size !== baseline.size || [...selected].some((id) => !baseline.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    save.mutate([...selected], {
      onSuccess: () => toast.success("태그를 저장했습니다"),
      onError: () => toast.error("태그 저장에 실패했습니다"),
    });
  }

  return (
    <div className="space-y-5">
      {taxonomy.data.map((group) => (
        <div key={group.id} className="bg-card ring-foreground/10 rounded-xl p-4 ring-1 sm:p-5">
          <div className="mb-3">
            <h3 className="text-sm font-medium">{group.label}</h3>
            {group.description && (
              <p className="text-muted-foreground mt-0.5 text-xs">{group.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.options.map((opt) => {
              const on = selected.has(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.description ?? undefined}
                  aria-pressed={on}
                  onClick={() => toggle(opt.id)}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
            {group.options.length === 0 && (
              <span className="text-muted-foreground text-xs">항목 없음</span>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-muted-foreground text-xs">저장되지 않은 변경사항</span>}
        <Button type="button" onClick={handleSave} disabled={!dirty || save.isPending}>
          {save.isPending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </div>
  );
}
