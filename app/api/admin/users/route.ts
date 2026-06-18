import { getUsers } from "@/entities/user/api/get-users.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET() {
  try {
    return Response.json(await getUsers());
  } catch (error) {
    return toErrorResponse(error);
  }
}
