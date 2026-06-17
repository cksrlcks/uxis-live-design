import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/legacy/lib/db";
import { pinComments, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { resolveViewerGate } from "@/legacy/lib/access/viewer-gate";
import { getProfile } from "@/legacy/lib/auth/session";
import { validateChatBody } from "@/legacy/lib/meeting/chat"; // 범용 본문 검증(≤2000, trim) 재사용
import { clamp01 } from "@/legacy/lib/realtime/coords";
import { loadPinsForVersion } from "@/legacy/lib/pins/load-pins";
import type { PinDTO } from "@/legacy/lib/pins/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal || decision !== "allow") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const variantId = req.nextUrl.searchParams.get("variant") ?? "";
  const versionId = req.nextUrl.searchParams.get("version") ?? "";
  if (!variantId || !versionId) return NextResponse.json({ error: "BAD_QUERY" }, { status: 400 });

  // 소속 확인: variant가 이 proposal 것인지, version이 그 variant 것인지(POST와 동일).
  const v = await db.select({ id: proposalVariants.id }).from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, proposal.id))).limit(1);
  if (v.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const ver = await db.select({ id: proposalVersions.id }).from(proposalVersions)
    .where(and(eq(proposalVersions.id, versionId), eq(proposalVersions.variantId, variantId))).limit(1);
  if (ver.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const pins = await loadPinsForVersion(variantId, versionId);
  return NextResponse.json({ pins });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal || decision !== "allow") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const body = validateChatBody(json?.body);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const variantId = typeof json?.variantId === "string" ? json.variantId : "";
  const versionId = typeof json?.versionId === "string" ? json.versionId : "";
  const pageOrder = Number(json?.pageOrder);
  const authorColor = typeof json?.authorColor === "string" ? json.authorColor.trim().slice(0, 32) : "";
  if (
    !variantId || !versionId || !Number.isInteger(pageOrder) || pageOrder < 0 || !authorColor ||
    typeof json?.xNorm !== "number" || typeof json?.yNorm !== "number"
  ) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  // 소속 검증: variant→proposal, version→variant, page_order가 그 버전 페이지 범위.
  const v = await db.select({ id: proposalVariants.id }).from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, proposal.id))).limit(1);
  if (v.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const ver = await db.select({ id: proposalVersions.id }).from(proposalVersions)
    .where(and(eq(proposalVersions.id, versionId), eq(proposalVersions.variantId, variantId))).limit(1);
  if (ver.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const pg = await db.select({ id: proposalPages.id }).from(proposalPages)
    .where(and(eq(proposalPages.versionId, versionId), eq(proposalPages.pageOrder, pageOrder))).limit(1);
  if (pg.length === 0) return NextResponse.json({ error: "BAD_PAGE" }, { status: 400 });

  const id = randomUUID();
  const createdAt = new Date();
  const authorName = profile.displayName ?? profile.email.split("@")[0] ?? "사용자";
  const xNorm = clamp01(Number(json?.xNorm));
  const yNorm = clamp01(Number(json?.yNorm));

  await db.insert(pinComments).values({
    id, proposalId: proposal.id, variantId, versionId, pageOrder, xNorm, yNorm,
    authorId: profile.id, authorName, authorColor, body, createdAt,
  });

  const pin: PinDTO = {
    id, variantId, versionId, pageOrder, xNorm, yNorm,
    authorId: profile.id, authorName, authorColor, body, resolved: false,
    createdAt: createdAt.toISOString(),
  };
  return NextResponse.json({ pin });
}
