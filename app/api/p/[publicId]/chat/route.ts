import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/legacy/lib/db";
import { chatMessages } from "@drizzle/schema";
import { resolveViewerGate } from "@/legacy/lib/access/viewer-gate";
import { validateChatBody } from "@/legacy/lib/meeting/chat";
import type { ChatMessageDTO } from "@/legacy/lib/meeting/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  // 저장 데이터는 항상 코드 게이트(visibility + unlock)를 통과한 경우에만(스펙 §7).
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal || decision !== "allow") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);

  const body = validateChatBody(json?.body);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  // 작성자 이름/색은 클라(게스트 신원)가 보낸다 — 길이만 방어적으로 제한.
  const authorName =
    typeof json?.authorName === "string" ? json.authorName.trim().slice(0, 80) : "";
  const authorColor =
    typeof json?.authorColor === "string" ? json.authorColor.trim().slice(0, 32) : "";
  if (!authorName || !authorColor) {
    return NextResponse.json({ error: "INVALID_AUTHOR" }, { status: 400 });
  }

  const id = randomUUID();
  const createdAt = new Date();
  await db.insert(chatMessages).values({
    id,
    proposalId: proposal.id,
    authorName,
    authorColor,
    body,
    createdAt,
  });

  const message: ChatMessageDTO = {
    id,
    authorName,
    authorColor,
    body,
    createdAt: createdAt.toISOString(),
  };
  return NextResponse.json({ message });
}
