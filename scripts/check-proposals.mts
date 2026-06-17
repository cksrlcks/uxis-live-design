import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
for (const rel of ["proposals", "proposal_variants", "proposal_versions", "proposal_pages", "chat_messages"]) {
  const r = await sql`select relrowsecurity, relforcerowsecurity from pg_class where relname = ${rel}`;
  console.log(rel, "RLS:", r[0]);
}
await sql.end();
