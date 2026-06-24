"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { TagOption } from "@/entities/tag";
import { useCreateOption, useUpdateOption } from "../api/use-tag-taxonomy-mutations";

export function OptionDialog({
  open,
  onOpenChange,
  groupId,
  option,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  option?: TagOption;
}) {
  const isEdit = !!option;
  const create = useCreateOption();
  const update = useUpdateOption();
  const [code, setCode] = useState(option?.code ?? "");
  const [label, setLabel] = useState(option?.label ?? "");
  const [description, setDescription] = useState(option?.description ?? "");
  const pending = create.isPending || update.isPending;

  function submit() {
    if (!label.trim()) {
      toast.error("이름을 입력하세요");
      return;
    }
    const desc = description.trim() || null;
    if (option) {
      // `option` 진리값으로 분기해야 TS가 option을 정의됨으로 좁힌다.
      update.mutate(
        { id: option.id, input: { label: label.trim(), description: desc } },
        {
          onSuccess: () => {
            toast.success("항목을 수정했습니다");
            onOpenChange(false);
          },
          onError: () => toast.error("수정에 실패했습니다"),
        },
      );
    } else {
      if (!code.trim()) {
        toast.error("코드를 입력하세요");
        return;
      }
      create.mutate(
        { groupId, code: code.trim(), label: label.trim(), description: desc },
        {
          onSuccess: () => {
            toast.success("항목을 추가했습니다");
            onOpenChange(false);
            setCode("");
            setLabel("");
            setDescription("");
          },
          onError: () => toast.error("추가에 실패했습니다(코드 중복일 수 있어요)"),
        },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "항목 수정" : "항목 추가"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="opt-code">코드(고정키)</Label>
              <Input
                id="opt-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="proposal"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="opt-label">이름</Label>
            <Input
              id="opt-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="제안"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opt-desc">설명(선택)</Label>
            <Input
              id="opt-desc"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>취소</DialogClose>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
