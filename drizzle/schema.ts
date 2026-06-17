import { pgTable, uuid, text, timestamp, integer, unique, check, index, real, boolean } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("proposals_visibility_check", sql`${t.visibility} in ('private', 'public')`),
]);

export const proposalVariants = pgTable("proposal_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull(),
  label: text("label").notNull(),
  slug: text("slug").notNull(),                  // URL용 고정 키
  sortOrder: integer("sort_order").notNull(),
  currentVersionId: uuid("current_version_id"),  // FK added via SQL (circular)
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("proposal_variants_proposal_slug_unique").on(t.proposalId, t.slug),
]);

export const proposalVersions = pgTable("proposal_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  variantId: uuid("variant_id").notNull(),
  versionNo: integer("version_no").notNull(),
  note: text("note"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("proposal_versions_variant_version_unique").on(t.variantId, t.versionNo),
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
export type ProposalVariant = typeof proposalVariants.$inferSelect;
export type ProposalVersion = typeof proposalVersions.$inferSelect;
export type ProposalPage = typeof proposalPages.$inferSelect;

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull(),     // FK added via SQL (기존 컨벤션)
  authorName: text("author_name").notNull(),
  authorColor: text("author_color").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("chat_messages_proposal_created_idx").on(t.proposalId, t.createdAt),
]);

export type ChatMessage = typeof chatMessages.$inferSelect;

export const pinComments = pgTable("pin_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull(),     // FK via SQL
  variantId: uuid("variant_id").notNull(),       // FK via SQL
  versionId: uuid("version_id").notNull(),        // FK via SQL
  pageOrder: integer("page_order").notNull(),
  xNorm: real("x_norm").notNull(),
  yNorm: real("y_norm").notNull(),
  authorId: uuid("author_id"),                    // FK via SQL (set null), 소유권 기준
  authorName: text("author_name").notNull(),
  authorColor: text("author_color").notNull(),
  body: text("body").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("pin_comments_variant_version_page_idx").on(t.variantId, t.versionId, t.pageOrder),
]);

export type PinComment = typeof pinComments.$inferSelect;
