"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { HttpError } from "@/shared/api/http";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { resetPasswordSchema, type ResetPasswordInput } from "../model/schema";
import { useResetPassword } from "../api/use-auth";

function resetErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.code === "WEAK_PASSWORD") return "더 안전한 비밀번호를 입력해주세요.";
    if (err.code === "SAME_PASSWORD") return "이전과 다른 비밀번호를 입력해주세요.";
    if (err.code === "RATE_LIMITED") return "잠시 후 다시 시도해주세요.";
    if (err.code === "UNAUTHORIZED") return "링크가 만료되었습니다. 다시 요청해주세요.";
  }
  return "비밀번호 변경 중 오류가 발생했습니다.";
}

export function ResetPasswordForm() {
  const resetMutation = useResetPassword();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    try {
      await resetMutation.mutateAsync(values);
      // 서버에서 recovery 세션을 막 종료했으므로 전체 문서 로드로 클라이언트 캐시를 비우고
      // 로그인 페이지를 성공 안내와 함께 새로 렌더한다.
      window.location.replace("/login?reset=success");
    } catch (err) {
      setFormError(resetErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2.5">
        <Label htmlFor="newPassword" className="text-muted-foreground font-normal">
          새 비밀번호
        </Label>
        <Input
          id="newPassword"
          type="password"
          placeholder="8자 이상"
          className="h-12 rounded-lg px-4"
          {...register("newPassword")}
        />
        {errors.newPassword && (
          <p className="text-destructive text-sm">{errors.newPassword.message}</p>
        )}
      </div>
      <div className="space-y-2.5">
        <Label htmlFor="confirmPassword" className="text-muted-foreground font-normal">
          새 비밀번호 확인
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="비밀번호를 다시 입력하세요"
          className="h-12 rounded-lg px-4"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
        )}
      </div>
      {formError && <p className="text-destructive text-sm">{formError}</p>}
      <Button
        type="submit"
        className="h-12 w-full rounded-lg text-base font-semibold"
        disabled={resetMutation.isPending}
      >
        {resetMutation.isPending ? "변경 중…" : "비밀번호 변경"}
      </Button>
    </form>
  );
}
