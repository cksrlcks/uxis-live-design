import { NextRequest } from "next/server";
import { updateDisplayName } from "@/features/auth/api/auth.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function PATCH(req: NextRequest) {
  try {
    await updateDisplayName(await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
