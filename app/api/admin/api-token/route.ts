import {
  getMyToken,
  regenerateMyToken,
  revokeMyToken,
} from "@/entities/api-token/api/token.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 현재 사용자의 API 토큰(없으면 null). 각 사용자가 자기 토큰만 다룬다(서버가 세션으로 소유자 판별).
export async function GET() {
  try {
    return Response.json(await getMyToken());
  } catch (error) {
    return toErrorResponse(error);
  }
}

// 발급/재발급.
export async function POST() {
  try {
    return Response.json(await regenerateMyToken(), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// 폐기.
export async function DELETE() {
  try {
    await revokeMyToken();
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
