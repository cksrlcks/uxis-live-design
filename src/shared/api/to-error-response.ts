import { ZodError } from "zod";

const STATUS_BY_CODE: Record<string, number> = {
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  LOGIN_REQUIRED: 401,
  NOT_FOUND: 404,
  INVALID_CREDENTIALS: 401,
  EMAIL_TAKEN: 409,
  SIGNUP_FAILED: 400,
  RATE_LIMITED: 429,
  LAST_VARIANT: 409,
  OBJECT_MISSING: 400,
};

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json({ error: "VALIDATION_ERROR", issues: error.issues }, { status: 400 });
  }
  if (error instanceof Error && STATUS_BY_CODE[error.message]) {
    return Response.json({ error: error.message }, { status: STATUS_BY_CODE[error.message] });
  }
  return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}
