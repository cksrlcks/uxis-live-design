import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { requireAdmin } from "@/shared/auth/guards.server";
import type { AdminUser, AuthProvider } from "../model/types";
import type { Role } from "@/shared/auth/roles";

type Row = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  providers: string[];
  created_at: Date;
};

export async function getUsers(): Promise<AdminUser[]> {
  await requireAdmin();
  // 가입수단(provider)은 우리 DB(profiles)가 아닌 Supabase auth.identities에 있다.
  // user_id로 LEFT JOIN해 provider를 array_agg로 모은다(한 사용자가 이메일·구글을
  // 모두 연결하면 2 row → 배열에 둘 다). drizzle 스키마에 없는 테이블이라 raw SQL.
  //  - ORDER BY i.provider : 정렬 결정적(매번 같은 순서)
  //  - FILTER + coalesce '{}' : identity가 없는 행도 빈 배열로 안전 처리
  const rows = await db.execute<Row>(sql`
    SELECT p.id,
           p.display_name AS name,
           p.email,
           p.role,
           p.created_at,
           coalesce(
             array_agg(i.provider ORDER BY i.provider)
               FILTER (WHERE i.provider IS NOT NULL),
             '{}'
           ) AS providers
    FROM profiles p
    LEFT JOIN auth.identities i ON i.user_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role as Role,
    providers: r.providers as AuthProvider[],
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
