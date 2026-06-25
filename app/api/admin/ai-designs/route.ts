import { NextRequest } from "next/server";
import { createAiDesign } from "@/entities/ai-design/api/create-ai-design.server";
import { listAiDesigns } from "@/entities/ai-design/api/list-ai-designs.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET() {
  try {
    return Response.json(await listAiDesigns());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    return Response.json(await createAiDesign(await req.json()), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
