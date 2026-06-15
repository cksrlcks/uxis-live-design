import { pgTable, uuid, text, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id (FK added via SQL)
  email: text("email").notNull(),
  displayName: text("display_name"),
  role: text("role").notNull().default("pending"), // 'pending' | 'editor' | 'admin'
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: uuid("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("profiles_role_check", sql`${t.role} in ('pending', 'editor', 'admin')`),
]);

export type Profile = typeof profiles.$inferSelect;
