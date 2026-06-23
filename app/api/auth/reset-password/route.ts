import { NextRequest } from "next/server";
import { resetPassword } from "@/features/auth/api/auth.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(req: NextRequest) {
  try {
    await resetPassword(await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
