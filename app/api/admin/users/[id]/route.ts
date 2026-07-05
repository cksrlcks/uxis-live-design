import { NextRequest } from "next/server";
import { updateUserRole } from "@/entities/user/api/update-user-role.server";
import { updateUserAnalyze } from "@/entities/user/api/update-user-analyze.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body && typeof body === "object" && "allowAnalyze" in body) {
      await updateUserAnalyze(id, body);
    } else {
      await updateUserRole(id, body);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
