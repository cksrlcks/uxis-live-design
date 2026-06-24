import { NextRequest } from "next/server";
import { createGroup } from "@/entities/tag/api/group-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(req: NextRequest) {
  try {
    return Response.json(await createGroup(await req.json()), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
