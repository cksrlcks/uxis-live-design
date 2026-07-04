import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isEditor, type Role } from "@/shared/auth/roles";
import { getCliAuthSession } from "@/entities/cli-auth";
import { CliAuthPage } from "@/pages/cli-auth";

export default async function Page({ params }: { params: Promise<{ authId: string }> }) {
  const { authId } = await params;
  const profile = await getProfile();
  if (!profile) redirect(`/login?returnTo=${encodeURIComponent(`/cli-auth/${authId}`)}`);
  if (!isEditor(profile.role as Role)) {
    return <CliAuthPage authId={authId} state="not-editor" />;
  }
  const session = await getCliAuthSession(authId);
  // denied는 폴링이 소비하기 전 새로고침한 경우 — 만료와 동일하게 "끝난 요청"으로 보여준다.
  const state = !session || session.status === "denied" ? "expired" : session.status;
  return <CliAuthPage authId={authId} state={state} />;
}
