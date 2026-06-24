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
    <div className="bg-card ring-foreground/10 rounded-xl ring-1">
      <div className="border-border/60 flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{group.label}</h3>
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

      <div className="divide-border/60 divide-y">
        {group.options.map((opt) => (
          <OptionRow key={opt.id} option={opt} />
        ))}
        {group.options.length === 0 && (
          <p className="text-muted-foreground px-4 py-3 text-xs">항목이 없습니다.</p>
        )}
      </div>

      <div className="p-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(true)}>
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
