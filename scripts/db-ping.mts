import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const rows = await sql`select 1 as ok`;
console.log("DB OK:", rows[0]);
await sql.end();
