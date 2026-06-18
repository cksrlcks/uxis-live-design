"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HttpError } from "@/shared/api/http";
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { loginSchema, type LoginInput } from "../model/schema";
import { useLogin } from "../api/use-auth";

function loginErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.code === "INVALID_CREDENTIALS") return "이메일 또는 비밀번호가 올바르지 않습니다.";
    if (err.code === "RATE_LIMITED") return "잠시 후 다시 시도해주세요.";
  }
  return "로그인 중 오류가 발생했습니다.";
}

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const loginMutation = useLogin();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await loginMutation.mutateAsync(values);
      router.replace(isSafeInternalPath(returnTo) ? returnTo : "/dashboard");
      router.refresh();
    } catch (err) {
      setFormError(loginErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" type="email" {...register("email")} />
        {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" type="password" {...register("password")} />
        {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
      </div>
      {formError && <p className="text-destructive text-sm">{formError}</p>}
      <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? "로그인 중…" : "로그인"}
      </Button>
    </form>
  );
}
