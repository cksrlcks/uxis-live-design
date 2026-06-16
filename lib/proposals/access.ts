export type AccessDecision = "allow" | "need-password" | "forbidden";

export function decideAccess(input: {
  visibility: string;
  hasPassword: boolean;
  isEditor: boolean;
  hasValidUnlock: boolean;
}): AccessDecision {
  if (input.isEditor) return "allow";
  if (input.visibility !== "public") return "forbidden";
  if (!input.hasPassword) return "allow";
  return input.hasValidUnlock ? "allow" : "need-password";
}
