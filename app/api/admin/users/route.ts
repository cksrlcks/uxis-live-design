import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/legacy/lib/db";
import { profiles } from "@drizzle/schema";
import { requireAdmin } from "@/legacy/lib/auth/session";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const rows = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
  return NextResponse.json(rows);
}
