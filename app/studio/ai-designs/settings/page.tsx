import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isAdmin, type Role } from "@/shared/auth/roles";
import {
  getAiSystemPrompt,
  updateAiSystemPrompt,
} from "@/entities/ai-design/api/ai-settings.server";
import { AiDesignSettingsPage } from "@/pages/ai-design-settings";

export default async function Page() {
  const profile = await getProfile();
  if (!profile || !isAdmin(profile.role as Role)) redirect("/studio");

  const prompt = await getAiSystemPrompt();

  // 인라인 Server Action — updateAiSystemPrompt가 내부에서 requireAdmin()으로 재검증한다.
  async function updatePrompt(content: string) {
    "use server";
    await updateAiSystemPrompt(content);
  }

  return <AiDesignSettingsPage initialPrompt={prompt} updatePrompt={updatePrompt} />;
}
