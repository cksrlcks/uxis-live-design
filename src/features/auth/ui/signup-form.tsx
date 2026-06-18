"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HttpError } from "@/shared/api/http";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { signupSchema, type SignupInput } from "../model/schema";
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

export function SignupForm() {
  const router = useRouter();
  const signupMutation = useSignup();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupInput) {
    setFormError(null);
    try {
      await signupMutation.mutateAsync(values);
      router.replace("/pending");
      router.refresh();
    } catch (err) {
      setFormError(signupErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">이름</Label>
        <Input id="name" type="text" {...register("name")} />
        {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
      </div>
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
      <Button type="submit" className="w-full" disabled={signupMutation.isPending}>
        {signupMutation.isPending ? "가입 중…" : "가입하기"}
      </Button>
    </form>
  );
}
