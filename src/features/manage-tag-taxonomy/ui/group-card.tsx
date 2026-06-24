"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TagGroupWithOptions } from "@/entities/tag";
import { Button } from "@/shared/ui/button";
import { useDeleteGroup } from "../api/use-tag-taxonomy-mutations";
import { GroupDialog } from "./group-dialog";
import { OptionDialog } from "./option-dialog";
import { OptionRow } from "./option-row";
import { ConfirmDialog } from "./confirm-dialog";

export function GroupCard({ group }: { group: TagGroupWithOptions }) {
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const del = useDeleteGroup();

  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
      {/* 구분 헤더 — 틴트 밴드 + 굵은 라벨 + 항목 수 배지로 '상위'임을 또렷하게 */}
      <div className="bg-muted/40 border-border/60 flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{group.label}</h3>
            <span className="bg-foreground/10 text-muted-foreground rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
              {group.options.length}
            </span>
            <span className="text-muted-foreground font-mono text-xs">{group.code}</span>
          </div>
          {group.description && (
            <p className="text-muted-foreground mt-0.5 text-xs">{group.description}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditOpen(true)}
            aria-label="구분 수정"
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setDelOpen(true)}
            aria-label="구분 삭제"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {/* 항목 목록 — 들여쓰기 + dot 마커로 '하위'임을 표시(OptionRow 내부) */}
      <div className="divide-border/50 divide-y">
        {group.options.map((opt) => (
          <OptionRow key={opt.id} option={opt} />
        ))}
        {group.options.length === 0 && (
          <p className="text-muted-foreground py-3 pr-3 pl-9 text-xs">항목이 없습니다.</p>
        )}
      </div>

      <div className="border-border/50 border-t p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAddOpen(true)}
          className="text-muted-foreground w-full justify-start"
        >
          <Plus />
          항목 추가
        </Button>
      </div>

      <GroupDialog open={editOpen} onOpenChange={setEditOpen} group={group} />
      <OptionDialog open={addOpen} onOpenChange={setAddOpen} groupId={group.id} />
      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title={`'${group.label}' 구분을 삭제할까요?`}
        description="이 구분의 모든 항목과, 항목이 선택된 시안의 태그 기록도 함께 삭제됩니다."
        onConfirm={() =>
          del.mutate(group.id, {
            onSuccess: () => {
              toast.success("구분을 삭제했습니다");
              setDelOpen(false);
            },
            onError: () => toast.error("삭제에 실패했습니다"),
          })
        }
        pending={del.isPending}
      />
    </div>
  );
}
