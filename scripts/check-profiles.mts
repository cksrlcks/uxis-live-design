import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const t = await sql`select relrowsecurity, relforcerowsecurity from pg_class where relname = 'profiles'`;
console.log("profiles RLS:", t[0]);
const trg = await sql`select tgname from pg_trigger where tgname = 'on_auth_user_created'`;
console.log("trigger:", trg[0] ?? "MISSING");
await sql.end();
