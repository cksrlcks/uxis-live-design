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
import type { TagGroup } from "@/entities/tag";
import { useCreateGroup, useUpdateGroup } from "../api/use-tag-taxonomy-mutations";

export function GroupDialog({
  open,
  onOpenChange,
  group,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  group?: TagGroup;
}) {
  const isEdit = !!group;
  const create = useCreateGroup();
  const update = useUpdateGroup();
  const [code, setCode] = useState(group?.code ?? "");
  const [label, setLabel] = useState(group?.label ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const pending = create.isPending || update.isPending;

  function submit() {
    if (!label.trim()) {
      toast.error("이름을 입력하세요");
      return;
    }
    const desc = description.trim() || null;
    if (group) {
      // `group` 진리값으로 분기해야 TS가 group을 정의됨으로 좁힌다(isEdit 불리언은 못 좁힘).
      update.mutate(
        { id: group.id, input: { label: label.trim(), description: desc } },
        {
          onSuccess: () => {
            toast.success("구분을 수정했습니다");
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
        { code: code.trim(), label: label.trim(), description: desc },
        {
          onSuccess: () => {
            toast.success("구분을 추가했습니다");
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
          <DialogTitle>{isEdit ? "구분 수정" : "구분 추가"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {!isEdit && (
            <div className="space-y-3">
              <Label htmlFor="group-code">코드(고정키)</Label>
              <Input
                id="group-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="purpose"
              />
            </div>
          )}
          <div className="space-y-3">
            <Label htmlFor="group-label">이름</Label>
            <Input
              id="group-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="목적"
            />
          </div>
          <div className="space-y-3">
            <Label htmlFor="group-desc">설명(선택)</Label>
            <Input
              id="group-desc"
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
