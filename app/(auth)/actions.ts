"use server";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/shared/supabase/server";
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";

export async function signup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  if (!name) return redirect(`/signup?error=${encodeURIComponent("이름을 입력하세요.")}`);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error) return redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  redirect("/pending");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const returnTo = formData.get("returnTo");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const qs = isSafeInternalPath(returnTo) ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
    return redirect(`/login?error=${encodeURIComponent(error.message)}${qs}`);
  }
  redirect(isSafeInternalPath(returnTo) ? returnTo : "/dashboard");
}

export async function logout() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
