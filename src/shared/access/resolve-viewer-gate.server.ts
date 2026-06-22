import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Proposal } from "@drizzle/schema";
import { getProfile } from "@/shared/auth/guards.server";
import { isEditor, type Role } from "@/shared/auth/roles";
import { decideAccess, type AccessDecision } from "@/shared/lib/proposals/access";
import { verifyUnlockToken, unlockCookieName } from "@/shared/access/unlock-token";
import { deriveViewerName } from "@/shared/access/viewer-name";
import { findViewerProposal } from "@/shared/access/find-viewer-proposal.server";

export type ViewerGate = {
  proposal: Proposal | null;
  decision: AccessDecision;
  viewerName: string | null;
  viewer: { id: string; displayName: string | null } | null;
};

// Single source of truth for public-viewer access, shared by the layout (to gate the
// realtime shell) and the page (to gate content). React.cache() dedupes within a request.
export const resolveViewerGate = cache(async (publicId: string): Promise<ViewerGate> => {
  // publicId 또는 공개 도메인 슬러그 둘 다 허용. 쿠키/토큰은 URL 파라미터 기준으로
  // 일관되게 키잉되므로(도메인 접근이면 도메인으로 일관) 추가 처리는 불필요.
  const proposal = await findViewerProposal(publicId);
  if (!proposal) return { proposal: null, decision: "forbidden", viewerName: null, viewer: null };

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
  return { proposal, decision, viewerName: deriveViewerName(profile), viewer };
});
