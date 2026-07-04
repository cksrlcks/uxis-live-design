"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { tagQueries } from "@/entities/tag";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useSaveVariantTags } from "../api/use-save-variant-tags";
import { shouldSyncSelection } from "../lib/sync-selection";

type Variant = { id: string; label: string };

// 안(variant)별 태깅 — 상단에서 안을 고르고, 그 안에 대해 태그를 지정한다.
export function ProposalTagsPanel({ variants }: { variants: Variant[] }) {
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const taxonomy = useQuery(tagQueries.taxonomy());
  const current = useQuery({ ...tagQueries.variant(variantId), enabled: !!variantId });
  const save = useSaveVariantTags(variantId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 안 전환/최초 로드 시 서버값으로 시드하되, 편집 중 백그라운드 refetch는 덮어쓰지 않는다.
  const syncedVariantRef = useRef<string | null>(null);
  useEffect(() => {
    if (!current.data) return;
    const isFirstSync = syncedVariantRef.current !== variantId;
    if (shouldSyncSelection(isFirstSync, selected, current.data.optionIds)) {
      syncedVariantRef.current = variantId;
      setSelected(new Set(current.data.optionIds));
    }
    // selected는 의도적으로 dep 제외 — current.data/variantId 변경 시에만 평가
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.data, variantId]);

  const variantBar =
    variants.length > 1 ? (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-caption text-muted-foreground mr-1">안</span>
        {variants.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setVariantId(v.id)}
            aria-pressed={v.id === variantId}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
              v.id === variantId
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-muted",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    ) : null;

  if (taxonomy.isPending || current.isPending) {
    return (
      <div className="space-y-5">
        {variantBar}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="rounded-card h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }
  if (taxonomy.isError || current.isError || !current.data) {
    return (
      <div className="space-y-5">
        {variantBar}
        <p className="text-destructive text-body">태그 정보를 불러오지 못했습니다.</p>
      </div>
    );
  }
  if (taxonomy.data.length === 0) {
    return (
      <div className="space-y-5">
        {variantBar}
        <p className="text-muted-foreground text-body">
          등록된 태그 분류가 없습니다. 관리자에게 문의하세요.
        </p>
      </div>
    );
  }

  const baseline = new Set(current.data.optionIds);
  const dirty = selected.size !== baseline.size || [...selected].some((id) => !baseline.has(id));

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
      {variantBar}
      {taxonomy.data.map((group) => (
        <Card key={group.id}>
          <CardHeader>
            <CardTitle>{group.label}</CardTitle>
            {group.description && <CardDescription>{group.description}</CardDescription>}
          </CardHeader>
          <CardContent>
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
                <span className="text-muted-foreground text-caption">항목 없음</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-muted-foreground text-caption">저장되지 않은 변경사항</span>}
        <Button type="button" size="lg" onClick={handleSave} disabled={!dirty || save.isPending}>
          {save.isPending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </div>
  );
}
