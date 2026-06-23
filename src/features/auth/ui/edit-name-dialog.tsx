"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { HttpError } from "@/shared/api/http";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { updateNameSchema, type UpdateNameInput } from "../model/schema";
import { useUpdateName } from "../api/use-auth";

function editNameErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.code === "VALIDATION_ERROR") return "이름을 다시 확인해주세요.";
    if (err.code === "RATE_LIMITED") return "잠시 후 다시 시도해주세요.";
    if (err.code === "UNAUTHORIZED") return "다시 로그인해주세요.";
  }
  return "이름 변경 중 오류가 발생했습니다.";
}

export function EditNameDialog({ displayName }: { displayName: string | null }) {
  const router = useRouter();
  const updateNameMutation = useUpdateName();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const name = displayName ?? "사용자";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateNameInput>({
    resolver: zodResolver(updateNameSchema),
    defaultValues: { name: displayName ?? "" },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({ name: displayName ?? "" });
      setFormError(null);
    }
  }

  async function onSubmit(values: UpdateNameInput) {
    setFormError(null);
    try {
      await updateNameMutation.mutateAsync(values);
      setOpen(false);
      toast.success("이름을 변경했습니다");
      router.refresh();
    } catch (err) {
      setFormError(editNameErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="hover:text-foreground/70 mt-4 inline-flex cursor-pointer items-center gap-1.5 text-lg font-semibold tracking-tight underline-offset-4 transition-colors hover:underline"
            aria-label="이름 변경"
          />
        }
      >
        {name}
        <Settings className="text-muted-foreground size-4" aria-hidden="true" />
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-5 p-6">
        <DialogHeader>
          <DialogTitle>이름 변경</DialogTitle>
          <DialogDescription>표시할 이름을 입력하세요.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2.5">
            <Label htmlFor="display-name" className="text-muted-foreground font-normal">
              이름
            </Label>
            <Input
              id="display-name"
              autoFocus
              maxLength={50}
              className="h-11 rounded-lg px-4"
              {...register("name")}
            />
            {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
          </div>

          {formError && <p className="text-destructive text-sm">{formError}</p>}

          <DialogFooter showCloseButton={false}>
            <DialogClose
              render={<Button type="button" variant="outline" className="h-10 rounded-lg" />}
            >
              취소
            </DialogClose>
            <Button type="submit" className="h-10 rounded-lg" disabled={updateNameMutation.isPending}>
              {updateNameMutation.isPending ? "변경 중…" : "변경"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
