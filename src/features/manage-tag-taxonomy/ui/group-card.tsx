"use client";

import { useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TagGroupWithOptions } from "@/entities/tag";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { useDeleteGroup } from "../api/use-tag-taxonomy-mutations";
import { GroupDialog } from "./group-dialog";
import { OptionDialog } from "./option-dialog";
import { OptionRow } from "./option-row";
import { ConfirmDialog } from "./confirm-dialog";

export function GroupCard({ group }: { group: TagGroupWithOptions }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const del = useDeleteGroup();

  return (
    <div className="bg-card rounded-card overflow-hidden border">
      {/* 구분 헤더 — 좌측 라벨 클릭/우측 chevron으로 펼침·접힘. 컨트롤은 세로 가운데 정렬 */}
      <div className="flex items-center gap-1 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="hover:bg-muted/50 rounded-control flex min-w-0 flex-1 flex-col items-start px-2 py-1.5 text-left transition-colors"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{group.label}</h3>
            <span className="text-muted-foreground/80 font-mono text-xs">{group.code}</span>
          </div>
          {group.description && (
            <p className="text-muted-foreground text-body mt-1 leading-relaxed">
              {group.description}
            </p>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-1">
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
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "접기" : "펼치기"}
          >
            <ChevronDown
              className={cn("transition-transform duration-200", !open && "-rotate-90")}
            />
          </Button>
        </div>
      </div>

      {open && (
        <>
          {/* 항목 목록 — 들여쓰기 + dot 마커로 '하위'임을 표시(OptionRow 내부) */}
          <div className="divide-border/50 border-border/60 divide-y border-t">
            {group.options.map((opt) => (
              <OptionRow key={opt.id} option={opt} />
            ))}
            {group.options.length === 0 && (
              <p className="text-muted-foreground text-body py-3 pr-3 pl-10">항목이 없습니다.</p>
            )}
          </div>

          <div className="border-border/50 border-t px-3 py-2">
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
        </>
      )}

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
