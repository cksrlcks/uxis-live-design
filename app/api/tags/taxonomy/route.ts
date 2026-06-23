import { getTaxonomy } from "@/entities/tag/api/get-taxonomy.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET() {
  try {
    return Response.json(await getTaxonomy());
  } catch (error) {
    return toErrorResponse(error);
  }
}
