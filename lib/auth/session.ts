import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, type Profile } from "@/drizzle/schema";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isEditor, isAdmin, type Role } from "@/lib/auth/roles";

export async function getSessionUser() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user; // null if not signed in
}

export async function getProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const rows = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  return rows[0] ?? null;
}

export async function requireEditor(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !isEditor(profile.role as Role)) throw new Error("FORBIDDEN");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !isAdmin(profile.role as Role)) throw new Error("FORBIDDEN");
  return profile;
}
