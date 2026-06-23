"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { z } from "zod";
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
import { changePasswordSchema } from "../model/schema";
import { useChangePassword } from "../api/use-auth";

// 새 비밀번호 확인은 클라이언트 전용 — 서버로는 currentPassword/newPassword만 보낸다.
const formSchema = changePasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "새 비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "현재 비밀번호와 다른 비밀번호를 사용하세요",
    path: ["newPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

function changePasswordErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.code === "INVALID_CREDENTIALS") return "현재 비밀번호가 올바르지 않습니다.";
    if (err.code === "SAME_PASSWORD") return "현재 비밀번호와 다른 비밀번호를 사용하세요.";
    if (err.code === "WEAK_PASSWORD") return "더 안전한 비밀번호를 사용하세요.";
    if (err.code === "RATE_LIMITED") return "잠시 후 다시 시도해주세요.";
  }
  return "비밀번호 변경 중 오류가 발생했습니다.";
}

export function ChangePasswordDialog() {
  const changePasswordMutation = useChangePassword();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset();
      setFormError(null);
      setDone(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      reset();
      setDone(true);
    } catch (err) {
      setFormError(changePasswordErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" className="h-11 w-full rounded-lg" />}>
        비밀번호 변경
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-5 p-6">
        <DialogHeader>
          <DialogTitle>비밀번호 변경</DialogTitle>
          <DialogDescription>현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.</DialogDescription>
        </DialogHeader>

        {done ? (
          <>
            <p className="text-sm text-[color-mix(in_oklab,var(--color-success),#000_30%)]">
              비밀번호가 변경되었습니다.
            </p>
            <DialogFooter showCloseButton={false}>
              <DialogClose render={<Button className="h-10 rounded-lg" />}>닫기</DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2.5">
              <Label htmlFor="current-password" className="text-muted-foreground font-normal">
                현재 비밀번호
              </Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                className="h-11 rounded-lg px-4"
                {...register("currentPassword")}
              />
              {errors.currentPassword && (
                <p className="text-destructive text-sm">{errors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="new-password" className="text-muted-foreground font-normal">
                새 비밀번호
              </Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="8자 이상"
                className="h-11 rounded-lg px-4"
                {...register("newPassword")}
              />
              {errors.newPassword && (
                <p className="text-destructive text-sm">{errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="confirm-password" className="text-muted-foreground font-normal">
                새 비밀번호 확인
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                className="h-11 rounded-lg px-4"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
              )}
            </div>

            {formError && <p className="text-destructive text-sm">{formError}</p>}

            <DialogFooter showCloseButton={false}>
              <DialogClose
                render={<Button type="button" variant="outline" className="h-10 rounded-lg" />}
              >
                취소
              </DialogClose>
              <Button
                type="submit"
                className="h-10 rounded-lg"
                disabled={changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending ? "변경 중…" : "변경"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
