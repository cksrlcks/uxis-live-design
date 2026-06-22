import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@drizzle/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

// HMR(dev)에서 모듈이 반복 재평가될 때마다 새 postgres 클라이언트가 생기면
// Supabase 트랜잭션 풀러 연결이 누적돼 "Failed query"로 이어진다.
// 전역에 클라이언트를 캐싱해 프로세스당 1개만 유지한다.
const globalForDb = globalThis as unknown as { __pgClient?: ReturnType<typeof postgres> };

// prepare:false is required for Supabase transaction pool mode
const client = globalForDb.__pgClient ?? postgres(connectionString, { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = client;

export const db = drizzle(client, { schema });
