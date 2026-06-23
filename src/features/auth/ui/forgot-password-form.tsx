"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import Link from "next/link";
import { HttpError } from "@/shared/api/http";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { forgotPasswordSchema, type ForgotPasswordInput } from "../model/schema";
import { useRequestPasswordReset } from "../api/use-auth";

function requestErrorMessage(err: unknown): string {
  if (err instanceof HttpError && err.code === "RATE_LIMITED") {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }
  return "메일 발송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

export function ForgotPasswordForm() {
  const requestMutation = useRequestPasswordReset();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    try {
      await requestMutation.mutateAsync(values);
      setSentTo(values.email);
    } catch (err) {
      setFormError(requestErrorMessage(err));
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed">
          <span className="font-medium">{sentTo}</span> 주소로 비밀번호 재설정 링크를 보냈습니다.
          받은 편지함과 스팸함을 확인해주세요.
        </p>
        <Link
          href="/login"
          className={buttonVariants({ className: "h-12 w-full rounded-lg text-base font-semibold" })}
        >
          로그인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2.5">
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
      {formError && <p className="text-destructive text-sm">{formError}</p>}
      <Button
        type="submit"
        className="h-12 w-full rounded-lg text-base font-semibold"
        disabled={requestMutation.isPending}
      >
        {requestMutation.isPending ? "전송 중…" : "재설정 링크 보내기"}
      </Button>
    </form>
  );
}
