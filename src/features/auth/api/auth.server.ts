import "server-only";
import { createSupabaseServer } from "@/shared/supabase/server";
import { changePasswordSchema, loginSchema, signupSchema } from "../model/schema";
import { signupErrorCode } from "./signup-error";

export async function signIn(input: unknown): Promise<void> {
  const { email, password } = loginSchema.parse(input);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 429) throw new Error("RATE_LIMITED");
    throw new Error("INVALID_CREDENTIALS");
  }
}

export async function signUp(input: unknown): Promise<void> {
  const { name, email, password } = signupSchema.parse(input);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error) {
    if (error.status === 429) throw new Error("RATE_LIMITED");
    throw new Error(signupErrorCode(error));
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
}

export async function changePassword(input: unknown): Promise<void> {
  const { currentPassword, newPassword } = changePasswordSchema.parse(input);
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("UNAUTHORIZED");

  // Supabase updateUser doesn't verify the old password — re-authenticate first so a
  // hijacked session can't silently change the password.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) {
    if (signInError.status === 429) throw new Error("RATE_LIMITED");
    throw new Error("INVALID_CREDENTIALS");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (error.status === 429) throw new Error("RATE_LIMITED");
    if (error.code === "same_password") throw new Error("SAME_PASSWORD");
    if (error.code === "weak_password") throw new Error("WEAK_PASSWORD");
    throw new Error("PASSWORD_UPDATE_FAILED");
  }
}
