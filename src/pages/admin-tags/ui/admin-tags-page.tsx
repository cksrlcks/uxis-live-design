"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { tagQueries } from "@/entities/tag";
import { GroupCard, GroupDialog } from "@/features/manage-tag-taxonomy";
import { PageHeader } from "@/widgets/studio-shell";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/skeleton";

export function AdminTagsPage() {
  const { data, isPending, isError } = useQuery(tagQueries.taxonomy());
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="태그 설정"
        description="시안에 태깅할 구분과 항목을 관리합니다."
        actions={
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Plus />
            구분 추가
          </Button>
        }
      />

      {isPending && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="rounded-card h-40 w-full" />
          ))}
        </div>
      )}
      {isError && <p className="text-body text-destructive">태그 분류를 불러오지 못했습니다.</p>}
      {data && data.length === 0 && (
        <EmptyState
          title="아직 구분이 없습니다"
          description="‘구분 추가’로 첫 태그 구분을 만들어 보세요."
          action={
            <Button type="button" onClick={() => setAddOpen(true)}>
              <Plus />
              구분 추가
            </Button>
          }
        />
      )}
      {data && data.length > 0 && (
        <div className="space-y-4">
          {data.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}

      <GroupDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
