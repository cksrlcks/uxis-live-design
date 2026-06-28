"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { toast } from "sonner";
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
import { useChangePassword } from "../api/use-auth";

const newPasswordRule = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다")
  .regex(/[A-Za-z]/, "영문을 포함해야 합니다")
  .regex(/[0-9]/, "숫자를 포함해야 합니다")
  .regex(/[^A-Za-z0-9]/, "특수문자를 포함해야 합니다");

function buildSchema(isOAuthUser: boolean) {
  return z
    .object({
      currentPassword: z.string().optional(),
      newPassword: newPasswordRule,
      confirmPassword: z.string(),
    })
    .refine((d) => isOAuthUser || (d.currentPassword !== undefined && d.currentPassword.length > 0), {
      message: "현재 비밀번호를 입력하세요",
      path: ["currentPassword"],
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: "새 비밀번호가 일치하지 않습니다",
      path: ["confirmPassword"],
    })
    .refine((d) => isOAuthUser || d.currentPassword !== d.newPassword, {
      message: "현재 비밀번호와 다른 비밀번호를 사용하세요",
      path: ["newPassword"],
    });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

function changePasswordErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.code === "INVALID_CREDENTIALS") return "현재 비밀번호가 올바르지 않습니다.";
    if (err.code === "SAME_PASSWORD") return "현재 비밀번호와 다른 비밀번호를 사용하세요.";
    if (err.code === "WEAK_PASSWORD") return "더 안전한 비밀번호를 사용하세요.";
    if (err.code === "RATE_LIMITED") return "잠시 후 다시 시도해주세요.";
  }
  return "비밀번호 변경 중 오류가 발생했습니다.";
}

export function ChangePasswordDialog({ isOAuthUser = false }: { isOAuthUser?: boolean }) {
  const changePasswordMutation = useChangePassword();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(buildSchema(isOAuthUser)) });

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
        currentPassword: isOAuthUser ? undefined : values.currentPassword,
        newPassword: values.newPassword,
      });
      reset();
      setDone(true);
      toast.success("비밀번호를 변경했습니다");
    } catch (err) {
      setFormError(changePasswordErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" className="h-11 w-full rounded-lg" />}>
        비밀번호 변경
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>비밀번호 변경</DialogTitle>
          <DialogDescription>
            {isOAuthUser
              ? "새 비밀번호를 설정합니다."
              : "현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다."}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <>
            <p className="text-sm text-[color-mix(in_oklab,var(--color-success),#000_30%)]">
              비밀번호가 변경되었습니다.
            </p>
            <DialogFooter showCloseButton={false}>
              <DialogClose render={<Button />}>닫기</DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {!isOAuthUser && (
              <div className="space-y-3">
                <Label htmlFor="current-password">현재 비밀번호</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  {...register("currentPassword")}
                />
                {errors.currentPassword && (
                  <p className="text-destructive text-sm">{errors.currentPassword.message}</p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <Label htmlFor="new-password">새 비밀번호</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                autoFocus={isOAuthUser}
                placeholder="영문·숫자·특수문자 포함 8자 이상"
                {...register("newPassword")}
              />
              {errors.newPassword && (
                <p className="text-destructive text-sm">{errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
              )}
            </div>

            {formError && <p className="text-destructive text-sm">{formError}</p>}

            <DialogFooter showCloseButton={false}>
              <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? "변경 중…" : "변경"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
