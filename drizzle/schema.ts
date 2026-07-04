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
  // 라이브 모드. 끄면 뷰어에서 협업(접속자/채팅/핀코멘트/화이트보드)을 서버 차원에서 전부 차단한다.
  // 기존 시안 동작 보존을 위해 기본 켜짐(true).
  liveMode: boolean("live_mode").notNull().default(true),
  // 유시스웍스(포트폴리오/갤러리) 노출 여부. visibility(공개 링크 접근)와 독립된 축.
  exposedToUxisworks: boolean("exposed_to_uxisworks").notNull().default(false),
  workYear: integer("work_year"), // 작업 연도(선택, nullable)
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
  // 영역(드래그) 코멘트일 때만 채워짐(둘 다 NULL = 점 코멘트). 페이지 기준 정규화 너비/높이.
  wNorm: real("w_norm"),
  hNorm: real("h_norm"),
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

// 안(variant)별 태그 — proposal_tags(시안 단위)를 대체. 시안 안에 추가안이 생겨도 안별로 따로 태깅한다.
// 기존 proposal_tags는 각 시안의 첫 variant(sort_order 최소)로 이관(마이그레이션 0029). FK·CASCADE·RLS는 SQL.
export const variantTags = pgTable(
  "variant_tags",
  {
    variantId: uuid("variant_id").notNull(), // FK → proposal_variants (SQL, cascade)
    optionId: uuid("option_id").notNull(), // FK → tag_options (SQL, cascade)
    createdBy: uuid("created_by"), // FK → profiles (SQL, set null)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.variantId, t.optionId] }),
    index("variant_tags_option_idx").on(t.optionId),
  ],
);

export type VariantTag = typeof variantTags.$inferSelect;

// 플러그인 로그인 페어링 — 외부 브라우저 로그인 결과(토큰)를 플러그인이 폴링으로 회수할 때까지
// 잠깐 보관하는 1회용 저장소. key = 플러그인이 만든 uuid. 최초 폴링 시 삭제, TTL 5분.
export const pluginAuthPairings = pgTable("plugin_auth_pairings", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").notNull(), // { accessToken, refreshToken, expiresAt, user }
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PluginAuthPairing = typeof pluginAuthPairings.$inferSelect;

// === AI 시안 생성 (AI Design Generation) ===
export const aiDesigns = pgTable(
  "ai_designs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(), // 제목
    company: text("company"), // 회사명(선택)
    pageType: text("page_type").notNull(), // 'main' | 'dashboard' | 'subpage'
    extraNotes: text("extra_notes"), // 자유 추가 요청
    status: text("status").notNull().default("working"), // 'working' | 'done' | 'failed'
    html: text("html"), // 완료 시 채워짐
    analysis: text("analysis"), // 참고 시안/요구사항에 대한 짧은 분석글
    approach: text("approach"), // 참고 시안을 어떻게 도입했는지 설명
    errorMessage: text("error_message"),
    model: text("model"), // 사용 모델 id 기록
    createdBy: uuid("created_by"), // FK → profiles (SQL, set null)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("ai_designs_page_type_check", sql`${t.pageType} in ('main', 'dashboard', 'subpage')`),
    check("ai_designs_status_check", sql`${t.status} in ('working', 'done', 'failed')`),
  ],
);

export type AiDesign = typeof aiDesigns.$inferSelect;

// 생성 시점에 선택한 태그의 스냅샷. 라벨/정렬을 박아 두어 이후 구분/항목이
// 삭제·변경되어도 상세에 그 시점 기록이 그대로 보인다(ai_design_reference_proposals와 같은 패턴).
export const aiDesignTags = pgTable(
  "ai_design_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aiDesignId: uuid("ai_design_id").notNull(), // FK → ai_designs (SQL, cascade)
    optionId: uuid("option_id"), // FK → tag_options (SQL, set null) — nullable: 항목 삭제 후에도 기록 보존
    groupLabel: text("group_label").notNull(), // 생성 시점 구분 라벨 스냅샷
    optionLabel: text("option_label").notNull(), // 생성 시점 항목 라벨 스냅샷
    groupSort: integer("group_sort").notNull().default(0), // 상세 표시용 구분 정렬
    optionSort: integer("option_sort").notNull().default(0), // 상세 표시용 항목 정렬
  },
  (t) => [index("ai_design_tags_ai_design_idx").on(t.aiDesignId)],
);

export type AiDesignTag = typeof aiDesignTags.$inferSelect;

// 생성 시 OpenAI에 넘긴 참고 시안 이미지 스냅샷.
export const aiDesignReferenceProposals = pgTable(
  "ai_design_reference_proposals",
  {
    aiDesignId: uuid("ai_design_id").notNull(), // FK → ai_designs (SQL, cascade)
    proposalId: uuid("proposal_id"), // FK → proposals (SQL, set null) — nullable: 시안 삭제 후에도 기록 보존
    proposalTitle: text("proposal_title").notNull(), // 생성 시점의 제목 스냅샷
    imageUrl: text("image_url").notNull(), // 생성 시점의 URL 스냅샷
    sortOrder: integer("sort_order").notNull(), // OpenAI에 전달한 순서
  },
  (t) => [primaryKey({ columns: [t.aiDesignId, t.sortOrder] })],
);

export type AiDesignReferenceProposal = typeof aiDesignReferenceProposals.$inferSelect;

// === AI 설정 (AI Settings) ===
export const aiSettings = pgTable("ai_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// === 시안 사전 분석 (Design Analysis) ===
// proposal_pages 이미지를 1회 vision 분석해 재사용 가능한 디자인 패턴으로 저장한다.
// 시안=proposals, 이미지=proposal_pages, 태그=정규화 택소노미를 그대로 쓰고 이 위에 분석 레이어만 얹는다.
// 재분석 방지 키는 (page_id, analysis_version). 페이지는 버전 내 불변이라 page_id가 안정적 이미지 식별자다.
// 태그는 분석에 넣지 않고 검색 시점에 proposal_tags를 라이브 조인한다(태그 수정 즉시 반영).
// FK·CASCADE·RLS는 레포 컨벤션대로 SQL 마이그레이션에서 추가한다.
export const proposalPageAnalysis = pgTable(
  "proposal_page_analysis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id").notNull(), // FK → proposal_pages (SQL, cascade). 분석 대상 페이지
    proposalId: uuid("proposal_id").notNull(), // 검색 조인용 비정규화. FK → proposals (SQL, cascade)
    versionId: uuid("version_id").notNull(), // 무효화/추적용 비정규화. FK → proposal_versions (SQL, cascade)
    industry: text("industry"), // 추론 업종
    tone: text("tone"), // 톤앤매너
    styleKeywords: jsonb("style_keywords").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    summary: text("summary"), // 페이지 전체 요약
    promptSnippet: text("prompt_snippet"), // 생성 프롬프트용 요약 문장
    analysisVersion: text("analysis_version").notNull(), // 분석 기준 버전(재분석 판단)
    status: text("status").notNull().default("pending"), // 'pending' | 'analyzed' | 'failed' | 'skipped'
    model: text("model"), // 분석에 사용한 모델
    errorMessage: text("error_message"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("proposal_page_analysis_page_version_unique").on(t.pageId, t.analysisVersion),
    index("proposal_page_analysis_proposal_idx").on(t.proposalId),
    index("proposal_page_analysis_status_idx").on(t.status),
    check(
      "proposal_page_analysis_status_check",
      sql`${t.status} in ('pending', 'analyzed', 'failed', 'skipped')`,
    ),
  ],
);

export type ProposalPageAnalysis = typeof proposalPageAnalysis.$inferSelect;

// 페이지 내 섹션 단위 분석. 컴포넌트는 별도 테이블 없이 components(jsonb)에 인라인한다.
// section_type enum은 SECTION_TYPES(entities/design-analysis/model/constants.ts)와 동기화 유지.
export const proposalSectionAnalysis = pgTable(
  "proposal_section_analysis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageAnalysisId: uuid("page_analysis_id").notNull(), // FK → proposal_page_analysis (SQL, cascade)
    proposalId: uuid("proposal_id").notNull(), // 검색 비정규화. FK → proposals (SQL, cascade)
    sectionType: text("section_type").notNull(), // 고정 enum(check)
    orderIndex: integer("order_index").notNull(), // 페이지 내 섹션 순서
    layoutType: text("layout_type"), // 레이아웃 패턴(예: left-text-right-image)
    tone: text("tone"),
    backgroundType: text("background_type"),
    colorPalette: jsonb("color_palette").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    // 컴포넌트를 별도 테이블 없이 인라인: { type, styleKeywords[], usage }[]
    components: jsonb("components")
      .$type<{ type: string; styleKeywords: string[]; usage?: string | null }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    summary: text("summary"),
    promptSnippet: text("prompt_snippet"), // 생성 프롬프트용 섹션 요약
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("proposal_section_analysis_page_idx").on(t.pageAnalysisId),
    index("proposal_section_analysis_section_type_idx").on(t.sectionType),
    index("proposal_section_analysis_proposal_idx").on(t.proposalId),
    check(
      "proposal_section_analysis_section_type_check",
      sql`${t.sectionType} in ('hero','intro','about','service','product','portfolio','gallery','process','pricing','review','faq','contact','cta','footer')`,
    ),
  ],
);

export type ProposalSectionAnalysis = typeof proposalSectionAnalysis.$inferSelect;

// === API 토큰 (스킬 저장 인증) ===
// 사용자당 1개. studio에서 발급/열람/재발급하며, 스킬(cova-make-design)이 이 토큰으로 저장 API를 호출한다.
// "자기 토큰 열람"이 요구사항이라 token을 평문으로 저장한다(ai_designs 쓰기만 여는 저위험 토큰, 서버·RLS 뒤).
// FK·CASCADE·RLS는 SQL 마이그레이션에서 추가.
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(), // FK → profiles (SQL, cascade). 사용자당 1개
    token: text("token").notNull(), // 평문(열람용)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [
    unique("api_tokens_owner_unique").on(t.ownerId),
    unique("api_tokens_token_unique").on(t.token),
  ],
);

export type ApiToken = typeof apiTokens.$inferSelect;

// === CLI 인증 세션 (스킬 웹 로그인) ===
// 디바이스 플로우: 스킬이 세션 생성(pending) → 사용자가 브라우저에서 승인(approved)/거부(denied)
// → 스킬이 폴링으로 토큰을 1회 수령하면 세션 삭제. 토큰 문자열은 저장하지 않는다(api_tokens 참조).
// FK·RLS는 SQL 마이그레이션에서 수동 추가.
export const cliAuthSessions = pgTable("cli_auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(), // 곧 authId — 추측 불가 세션 식별자
  status: text("status").notNull().default("pending"), // pending | approved | denied
  ownerId: uuid("owner_id"), // 승인한 사용자. FK → profiles (SQL, cascade)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type CliAuthSession = typeof cliAuthSessions.$inferSelect;
