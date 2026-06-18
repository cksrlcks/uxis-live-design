import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals } from "@drizzle/schema";
import { getProfile } from "@/shared/auth/guards.server";
import { isEditor, type Role } from "@/shared/auth/roles";
import { decideAccess } from "@/shared/lib/proposals/access";
import { verifyUnlockToken, unlockCookieName } from "@/shared/access/unlock-token";
import type { ViewerGate } from "../model/types";

// Single source of truth for public-viewer access, shared by the layout (to gate the
// realtime shell) and the page (to gate content). React.cache() dedupes within a request.
export const resolveViewerGate = cache(async (publicId: string): Promise<ViewerGate> => {
  const rows = await db.select().from(proposals).where(eq(proposals.publicId, publicId)).limit(1);
  const proposal = rows[0] ?? null;
  if (!proposal) return { proposal: null, decision: "forbidden", editorName: null, viewer: null };

  const profile = await getProfile();
  const editor = isEditor(profile?.role as Role | undefined);

  const cookieStore = await cookies();
  const token = cookieStore.get(unlockCookieName(publicId))?.value ?? "";
  const nowSec = Math.floor(Date.now() / 1000);
  const hasValidUnlock =
    !!token && verifyUnlockToken(token, publicId, nowSec, process.env.ACCESS_TOKEN_SECRET!);

  const decision = decideAccess({
    visibility: proposal.visibility,
    hasPassword: !!proposal.accessPasswordHash,
    isEditor: editor,
    hasValidUnlock,
  });

  const viewer = profile ? { id: profile.id, displayName: profile.displayName } : null;
  return { proposal, decision, editorName: editor ? (profile?.displayName ?? null) : null, viewer };
});
