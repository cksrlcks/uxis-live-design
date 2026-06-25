import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isAdmin, type Role } from "@/shared/auth/roles";
import { AiDesignDetailPage } from "@/pages/ai-design-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile || !isAdmin(profile.role as Role)) redirect("/studio");
  const { id } = await params;
  return <AiDesignDetailPage id={id} />;
}
