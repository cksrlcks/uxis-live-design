import "server-only";
import { createSupabaseServer } from "@/shared/supabase/server";
import { loginSchema, signupSchema } from "../model/schema";
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
