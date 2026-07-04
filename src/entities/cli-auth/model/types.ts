// 폴링 응답. null = 세션 없음/만료(라우트에서 404).
export type CliAuthPollResult =
  | { status: "pending" }
  | { status: "denied" }
  | { status: "approved"; token: string };

export type CliAuthSessionStatus = "pending" | "approved" | "denied";
