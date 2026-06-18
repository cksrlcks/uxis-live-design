// Pure mapper for Supabase signUp errors → our typed codes (no Supabase import, so it's testable).
// Supabase config-dependent: with email confirmation OFF, a duplicate email returns an error
// ("User already registered" / code "user_already_exists"). We match code first, message as fallback.
export function signupErrorCode(error: {
  code?: string | null;
  message?: string | null;
}): "EMAIL_TAKEN" | "SIGNUP_FAILED" {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (
    code === "user_already_exists" ||
    /already (registered|been registered|exists)/i.test(message)
  ) {
    return "EMAIL_TAKEN";
  }
  return "SIGNUP_FAILED";
}
