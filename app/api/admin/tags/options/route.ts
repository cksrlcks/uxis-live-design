import { NextRequest } from "next/server";
import { createOption } from "@/entities/tag/api/option-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(req: NextRequest) {
  try {
    return Response.json(await createOption(await req.json()), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
