"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TagOption } from "@/entities/tag";
import { Button } from "@/shared/ui/button";
import { useDeleteOption } from "../api/use-tag-taxonomy-mutations";
import { OptionDialog } from "./option-dialog";
import { ConfirmDialog } from "./confirm-dialog";

export function OptionRow({ option }: { option: TagOption }) {
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const del = useDeleteOption();

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">{option.label}</span>
          <span className="text-muted-foreground font-mono text-xs">{option.code}</span>
        </div>
        {option.description && (
          <p className="text-muted-foreground truncate text-xs">{option.description}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setEditOpen(true)}
          aria-label="항목 수정"
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setDelOpen(true)}
          aria-label="항목 삭제"
        >
          <Trash2 />
        </Button>
      </div>

      <OptionDialog open={editOpen} onOpenChange={setEditOpen} groupId={option.groupId} option={option} />
      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title={`'${option.label}' 항목을 삭제할까요?`}
        description="이 항목이 선택된 시안의 태그 기록도 함께 삭제됩니다."
        onConfirm={() =>
          del.mutate(option.id, {
            onSuccess: () => {
              toast.success("항목을 삭제했습니다");
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
