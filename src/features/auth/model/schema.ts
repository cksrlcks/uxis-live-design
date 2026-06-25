import { z } from "zod";

// 새 비밀번호 공통 규칙 — 영문·숫자·특수문자를 모두 포함한 8자 이상.
// signup / changePassword / resetPassword 세 곳에서 동일하게 재사용한다.
const newPassword = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다")
  .regex(/[A-Za-z]/, "영문을 포함해야 합니다")
  .regex(/[0-9]/, "숫자를 포함해야 합니다")
  .regex(/[^A-Za-z0-9]/, "특수문자를 포함해야 합니다");

export const loginSchema = z.object({
  email: z.email("올바른 이메일을 입력하세요"),
  password: z.string().min(1, "비밀번호를 입력하세요"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요"),
  email: z.email("올바른 이메일을 입력하세요"),
  password: newPassword,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email("올바른 이메일을 입력하세요"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword,
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력하세요"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateNameSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요").max(50, "이름은 50자 이하여야 합니다"),
});
export type UpdateNameInput = z.infer<typeof updateNameSchema>;
