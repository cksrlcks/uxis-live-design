-- 1. 신규 테이블 proposal_variants (current_version_id FK는 versions 재구성 후 추가 — 순환 FK)
CREATE TABLE "proposal_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer NOT NULL,
	"current_version_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_variants_proposal_slug_unique" UNIQUE("proposal_id","slug")
);
--> statement-breakpoint
ALTER TABLE "proposal_variants" ADD CONSTRAINT "proposal_variants_proposal_id_proposals_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_variants" ADD CONSTRAINT "proposal_variants_created_by_profiles_fk" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE set null;
--> statement-breakpoint
-- 2. proposal_versions에 variant_id 추가(우선 NULL 허용)
ALTER TABLE "proposal_versions" ADD COLUMN "variant_id" uuid;
--> statement-breakpoint
-- 3. 기존 시안마다 안 1개 생성(label "A"/slug "a"), 기존 current_version_id 승계
INSERT INTO "proposal_variants" ("proposal_id", "label", "slug", "sort_order", "current_version_id", "created_by")
SELECT "id", 'A', 'a', 0, "current_version_id", "owner_id" FROM "proposals";
--> statement-breakpoint
-- 4. 기존 버전을 각 시안의 단일 안으로 재귀속
UPDATE "proposal_versions" v
SET "variant_id" = pv."id"
FROM "proposal_variants" pv
WHERE pv."proposal_id" = v."proposal_id";
--> statement-breakpoint
-- 5. variant_id 확정: NOT NULL + FK, 옛 proposal_id/unique 제거, 새 unique 추가
ALTER TABLE "proposal_versions" ALTER COLUMN "variant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "proposal_versions" DROP CONSTRAINT "proposal_versions_proposal_version_unique";
--> statement-breakpoint
ALTER TABLE "proposal_versions" DROP CONSTRAINT "proposal_versions_proposal_id_proposals_fk";
--> statement-breakpoint
ALTER TABLE "proposal_versions" DROP COLUMN "proposal_id";
--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_variant_id_variants_fk" FOREIGN KEY ("variant_id") REFERENCES "proposal_variants"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_variant_version_unique" UNIQUE("variant_id","version_no");
--> statement-breakpoint
-- 6. versions가 존재하므로 이제 variants.current_version_id 순환 FK 추가
ALTER TABLE "proposal_variants" ADD CONSTRAINT "proposal_variants_current_version_id_versions_fk" FOREIGN KEY ("current_version_id") REFERENCES "proposal_versions"("id") ON DELETE set null;
--> statement-breakpoint
-- 7. proposals.current_version_id 제거(안 레벨로 이동)
ALTER TABLE "proposals" DROP CONSTRAINT "proposals_current_version_id_versions_fk";
--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "current_version_id";
--> statement-breakpoint
-- 8. 신규 테이블 RLS deny 백스톱(기존 테이블과 동일)
ALTER TABLE "proposal_variants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_variants" FORCE ROW LEVEL SECURITY;
