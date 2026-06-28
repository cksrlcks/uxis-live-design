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
    <div className="group/row hover:bg-muted/40 flex items-start justify-between gap-3 py-3 pr-3 pl-5 transition-colors">
      <div className="flex min-w-0 gap-2.5">
        {/* dot 마커 — 항목이 구분의 하위 목록임을 시각적으로 표시 */}
        <span className="bg-muted-foreground/40 mt-1.5 size-1.5 shrink-0 rounded-full" aria-hidden />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">{option.label}</span>
            <span className="text-muted-foreground font-mono text-xs">{option.code}</span>
          </div>
          {option.description && (
            <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
              {option.description}
            </p>
          )}
        </div>
      </div>
      {/* 항목 컨트롤 — 호버/포커스 시에만 노출(구분 헤더의 상시 컨트롤과 대비) */}
      <div className="flex shrink-0 items-center gap-0.5 self-center opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
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
