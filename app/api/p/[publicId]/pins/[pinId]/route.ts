import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pinComments } from "@/drizzle/schema";
import { resolveViewerGate } from "@/lib/access/viewer-gate";
import { getProfile } from "@/lib/auth/session";
import { validateChatBody } from "@/lib/meeting/chat";
import type { PinDTO } from "@/lib/pins/types";

function toDTO(r: typeof pinComments.$inferSelect): PinDTO {
  return {
    id: r.id, variantId: r.variantId, versionId: r.versionId, pageOrder: r.pageOrder,
    xNorm: r.xNorm, yNorm: r.yNorm, authorId: r.authorId, authorName: r.authorName,
    authorColor: r.authorColor, body: r.body, resolved: r.resolved, createdAt: r.createdAt.toISOString(),
  };
}

async function gateAndLoad(publicId: string, pinId: string) {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal || decision !== "allow") return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  const profile = await getProfile();
  if (!profile) return { error: NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 }) };
  const rows = await db.select().from(pinComments)
    .where(and(eq(pinComments.id, pinId), eq(pinComments.proposalId, proposal.id))).limit(1);
  if (rows.length === 0) return { error: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }) };
  return { error: null, profile, pin: rows[0] }; // error:null → 호출부 `if (g.error)` 내로잉으로 profile/pin 사용 가능
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ publicId: string; pinId: string }> }) {
  const { publicId, pinId } = await params;
  const g = await gateAndLoad(publicId, pinId);
  if (g.error) return g.error;
  const { profile, pin } = g;

  const json = await req.json().catch(() => null);
  const hasBody = typeof json?.body === "string";
  const hasResolved = typeof json?.resolved === "boolean";
  if (hasBody === hasResolved) return NextResponse.json({ error: "ONE_FIELD" }, { status: 400 }); // 정확히 하나

  if (hasBody) {
    if (pin.authorId !== profile.id) return NextResponse.json({ error: "NOT_AUTHOR" }, { status: 403 });
    const body = validateChatBody(json.body);
    if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    await db.update(pinComments).set({ body }).where(eq(pinComments.id, pinId));
    return NextResponse.json({ pin: toDTO({ ...pin, body }) });
  }
  // resolved: 로그인 누구나
  await db.update(pinComments).set({ resolved: json.resolved }).where(eq(pinComments.id, pinId));
  return NextResponse.json({ pin: toDTO({ ...pin, resolved: json.resolved }) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ publicId: string; pinId: string }> }) {
  const { publicId, pinId } = await params;
  const g = await gateAndLoad(publicId, pinId);
  if (g.error) return g.error;
  const { profile, pin } = g;
  if (pin.authorId !== profile.id) return NextResponse.json({ error: "NOT_AUTHOR" }, { status: 403 });
  await db.delete(pinComments).where(eq(pinComments.id, pinId));
  return NextResponse.json({ id: pinId });
}
