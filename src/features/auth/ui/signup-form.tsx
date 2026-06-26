"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { HttpError } from "@/shared/api/http";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";
import { signupFormSchema, type SignupFormValues } from "../model/schema";
import { useSignup } from "../api/use-auth";

function signupErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.code === "EMAIL_TAKEN") return "이미 가입된 이메일입니다.";
    if (err.code === "RATE_LIMITED") return "잠시 후 다시 시도해주세요.";
    if (err.code === "SIGNUP_FAILED" || err.code === "VALIDATION_ERROR") {
      return "가입에 실패했습니다. 입력을 확인해주세요.";
    }
  }
  return "회원가입 중 오류가 발생했습니다.";
}

export function SignupForm({ returnTo }: { returnTo?: string }) {
  const signupMutation = useSignup();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupFormSchema) });

  async function onSubmit({ confirmPassword: _confirmPassword, ...payload }: SignupFormValues) {
    setFormError(null);
    try {
      await signupMutation.mutateAsync(payload);
      // Full-document load so any stale client router cache is discarded before the new session renders.
      window.location.replace(isSafeInternalPath(returnTo) ? returnTo : "/pending");
    } catch (err) {
      setFormError(signupErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-3">
        <Label htmlFor="name" className="text-muted-foreground font-normal">
          이름
        </Label>
        <Input id="name" type="text" className="h-12 rounded-lg px-4" {...register("name")} />
        {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
      </div>
      <div className="space-y-3">
        <Label htmlFor="email" className="text-muted-foreground font-normal">
          이메일
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          className="h-12 rounded-lg px-4"
          {...register("email")}
        />
        {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
      </div>
      <div className="space-y-3">
        <Label htmlFor="password" className="text-muted-foreground font-normal">
          비밀번호
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="영문·숫자·특수문자 포함 8자 이상"
          className="h-12 rounded-lg px-4"
          {...register("password")}
        />
        {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
      </div>
      <div className="space-y-3">
        <Label htmlFor="confirmPassword" className="text-muted-foreground font-normal">
          비밀번호 확인
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
        className="h-12 w-full rounded-lg bg-blue-600 text-base font-semibold text-white hover:bg-blue-700"
        disabled={signupMutation.isPending}
      >
        {signupMutation.isPending ? "가입 중…" : "가입하기"}
      </Button>
    </form>
  );
}
