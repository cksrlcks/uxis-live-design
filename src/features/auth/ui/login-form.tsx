"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import Link from "next/link";
import { HttpError } from "@/shared/api/http";
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";
import { cn } from "@/shared/lib/utils";
import { Button, buttonVariants } from "@/shared/ui/button";
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
  const loginMutation = useLogin();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // 구글 로그인은 서버 라우트로 전체 이동시켜 시작한다(OAuth는 fetch가 아닌 브라우저 리다이렉트).
  const googleHref =
    "/api/auth/oauth/google" +
    (isSafeInternalPath(returnTo) ? `?next=${encodeURIComponent(returnTo)}` : "");

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await loginMutation.mutateAsync(values);
      // Full-document load so the client router cache (which may hold a previous user's
      // server-rendered /studio segment) is fully discarded before the new session renders.
      window.location.replace(isSafeInternalPath(returnTo) ? returnTo : "/");
    } catch (err) {
      setFormError(loginErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
          placeholder="6자 이상"
          className="h-12 rounded-lg px-4"
          {...register("password")}
        />
        {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
      </div>
      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          비밀번호를 잊으셨나요?
        </Link>
      </div>
      {formError && <p className="text-destructive text-sm">{formError}</p>}
      <Button
        type="submit"
        className="h-12 w-full rounded-lg bg-blue-600 text-base font-semibold text-white hover:bg-blue-700"
        disabled={loginMutation.isPending}
      >
        {loginMutation.isPending ? "로그인 중…" : "로그인"}
      </Button>
      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">또는</span>
        <span className="bg-border h-px flex-1" />
      </div>
      <a
        href={googleHref}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-12 w-full gap-3 rounded-lg text-base font-medium",
        )}
      >
        <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5">
          <path
            fill="#FFC107"
            d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
          />
          <path
            fill="#FF3D00"
            d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
          />
        </svg>
        Google로 계속하기
      </a>
    </form>
  );
}
