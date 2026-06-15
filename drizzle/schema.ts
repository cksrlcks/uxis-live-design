import { pgTable, uuid, text, timestamp, integer, unique, check } from "drizzle-orm/pg-core";
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

export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicId: text("public_id").notNull().unique(),
  title: text("title").notNull(),
  ownerId: uuid("owner_id").notNull(),
  visibility: text("visibility").notNull().default("private"), // 'private' | 'public'
  accessPasswordHash: text("access_password_hash"), // 'salt:hash' (scrypt), public+password only
  currentVersionId: uuid("current_version_id"), // FK added via SQL (circular)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("proposals_visibility_check", sql`${t.visibility} in ('private', 'public')`),
]);

export const proposalVersions = pgTable("proposal_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull(),
  versionNo: integer("version_no").notNull(),
  note: text("note"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("proposal_versions_proposal_version_unique").on(t.proposalId, t.versionNo),
]);

export const proposalPages = pgTable("proposal_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionId: uuid("version_id").notNull(),
  pageOrder: integer("page_order").notNull(),
  storagePath: text("storage_path").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
}, (t) => [
  unique("proposal_pages_version_order_unique").on(t.versionId, t.pageOrder),
]);

export type Proposal = typeof proposals.$inferSelect;
export type ProposalVersion = typeof proposalVersions.$inferSelect;
export type ProposalPage = typeof proposalPages.$inferSelect;
