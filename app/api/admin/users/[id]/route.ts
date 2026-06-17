import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/legacy/lib/db";
import { profiles } from "@drizzle/schema";
import { requireAdmin } from "@/legacy/lib/auth/session";
import { ROLES } from "@/legacy/lib/auth/roles";

const ALLOWED = new Set<string>([ROLES.PENDING, ROLES.EDITOR, ROLES.ADMIN]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: "CANNOT_MODIFY_SELF" }, { status: 400 });
  }
  const body = await req.json();
  const role = String(body.role);
  if (!ALLOWED.has(role)) return NextResponse.json({ error: "INVALID_ROLE" }, { status: 400 });

  await db.update(profiles)
    .set({
      role,
      approvedAt: role === ROLES.PENDING ? null : new Date(),
      approvedBy: role === ROLES.PENDING ? null : admin.id,
    })
    .where(eq(profiles.id, id));
  return NextResponse.json({ ok: true });
}
