import { pgTable, uuid, text, timestamp, integer, unique, check, index, real, boolean, jsonb, primaryKey } from "drizzle-orm/pg-core";
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
  domain: text("domain").unique(), // 사람이 읽는 공개 URL 식별자(슬러그). nullable: 기존 행 호환
  title: text("title").notNull(),
  participants: text("participants"), // 참여자 명단(쉼표 구분, nullable). 시안 검색 대상.
  figmaUrl: text("figma_url"), // 원본 Figma 파일 링크(nullable).
  ownerId: uuid("owner_id").notNull(),
  visibility: text("visibility").notNull().default("private"), // 'private' | 'public'
  accessPasswordHash: text("access_password_hash"), // 'salt:hash' (scrypt), public+password only
  whiteboardEnabled: boolean("whiteboard_enabled").notNull().default(false),
  // 유시스웍스(포트폴리오/갤러리) 노출 여부. visibility(공개 링크 접근)와 독립된 축.
  exposedToUxisworks: boolean("exposed_to_uxisworks").notNull().default(false),
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
  authorId: uuid("author_id"),                    // FK via SQL (set null), 소유권 기준 — 게스트는 null
  authorName: text("author_name").notNull(),
  authorColor: text("author_color").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  editedAt: timestamp("edited_at", { withTimezone: true }),   // 수정 시각(수정됨 표시)
  deletedAt: timestamp("deleted_at", { withTimezone: true }), // 소프트 삭제 시각(삭제된 메시지 표시)
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

// 버전 종속 화이트보드 — 한 사용자가 한 페이지에 그린 획들을 한 row(strokes 배열)로 묶는다.
// pin_comments와 동일 스코프 체계. 로그인 사용자만 그릴 수 있어 author_id는 NOT NULL.
// strokes: { drawId, points:[{x,y}], color, width }[] (정규화 경로). 쓰기는 (author_id, variant,
// version, page_order) 유니크로 upsert → 사용자별 페이지 레이어가 정확히 한 row.
export const whiteboardStrokes = pgTable("whiteboard_strokes", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull(),     // FK via SQL
  variantId: uuid("variant_id").notNull(),       // FK via SQL
  versionId: uuid("version_id").notNull(),       // FK via SQL
  pageOrder: integer("page_order").notNull(),
  authorId: uuid("author_id").notNull(),         // FK via SQL — 소유권·레이어 키(로그인 강제)
  authorName: text("author_name").notNull(),
  authorColor: text("author_color").notNull(),
  strokes: jsonb("strokes").notNull(),           // StoredStroke[]
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("whiteboard_strokes_author_page_uq").on(t.authorId, t.variantId, t.versionId, t.pageOrder),
  index("whiteboard_strokes_variant_version_page_idx").on(t.variantId, t.versionId, t.pageOrder),
]);

export type WhiteboardStroke = typeof whiteboardStrokes.$inferSelect;

// 시안 태그 — 관리자가 관리하는 분류(그룹/옵션) + 시안별 선택(조인 테이블).
// FK·CASCADE·RLS는 레포 컨벤션대로 SQL 마이그레이션에서 추가한다.
export const tagGroups = pgTable("tag_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // 고정키(라벨 변경에도 안정)
  label: text("label").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tagOptions = pgTable("tag_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull(), // FK → tag_groups (SQL)
  code: text("code").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("tag_options_group_code_unique").on(t.groupId, t.code),
]);

export const proposalTags = pgTable("proposal_tags", {
  proposalId: uuid("proposal_id").notNull(), // FK → proposals (SQL, cascade)
  optionId: uuid("option_id").notNull(),     // FK → tag_options (SQL, cascade)
  createdBy: uuid("created_by"),             // FK → profiles (SQL, set null)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.proposalId, t.optionId] }),
  index("proposal_tags_option_idx").on(t.optionId),
]);

export type TagGroup = typeof tagGroups.$inferSelect;
export type TagOption = typeof tagOptions.$inferSelect;
export type ProposalTag = typeof proposalTags.$inferSelect;

// 플러그인 로그인 페어링 — 외부 브라우저 로그인 결과(토큰)를 플러그인이 폴링으로 회수할 때까지
// 잠깐 보관하는 1회용 저장소. key = 플러그인이 만든 uuid. 최초 폴링 시 삭제, TTL 5분.
export const pluginAuthPairings = pgTable("plugin_auth_pairings", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").notNull(), // { accessToken, refreshToken, expiresAt, user }
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PluginAuthPairing = typeof pluginAuthPairings.$inferSelect;
