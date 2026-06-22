import { NextRequest } from "next/server";
import { checkDomainAvailable } from "@/entities/proposal/api/check-domain.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain");
    const exclude = searchParams.get("exclude") ?? undefined;
    return Response.json(await checkDomainAvailable(domain, exclude));
  } catch (error) {
    return toErrorResponse(error);
  }
}
