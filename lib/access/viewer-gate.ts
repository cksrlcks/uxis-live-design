import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, type Proposal } from "@/drizzle/schema";
import { getProfile } from "@/lib/auth/session";
import { isEditor, type Role } from "@/lib/auth/roles";
import { decideAccess, type AccessDecision } from "@/lib/proposals/access";
import { verifyUnlockToken, unlockCookieName } from "@/lib/access/cookie";

export type ViewerGate = {
  proposal: Proposal | null;
  decision: AccessDecision;
  editorName: string | null;
  viewer: { id: string; displayName: string | null } | null;
};

// Single source of truth for public-viewer access, shared by the layout (to gate the
// realtime shell) and the page (to gate content). One light proposal fetch per call.
// React.cache() dedupes across layout + page within the same request — only one DB read.
export const resolveViewerGate = cache(async (publicId: string): Promise<ViewerGate> => {
  const rows = await db.select().from(proposals).where(eq(proposals.publicId, publicId)).limit(1);
  const proposal = rows[0] ?? null;
  if (!proposal) return { proposal: null, decision: "forbidden", editorName: null, viewer: null };

  const profile = await getProfile();
  const editor = isEditor(profile?.role as Role | undefined);

  const cookieStore = await cookies();
  const token = cookieStore.get(unlockCookieName(publicId))?.value ?? "";
  const nowSec = Math.floor(Date.now() / 1000);
  const hasValidUnlock = !!token &&
    verifyUnlockToken(token, publicId, nowSec, process.env.ACCESS_TOKEN_SECRET!);

  const decision = decideAccess({
    visibility: proposal.visibility,
    hasPassword: !!proposal.accessPasswordHash,
    isEditor: editor,
    hasValidUnlock,
  });

  const viewer = profile ? { id: profile.id, displayName: profile.displayName } : null;
  return { proposal, decision, editorName: editor ? (profile?.displayName ?? null) : null, viewer };
});
