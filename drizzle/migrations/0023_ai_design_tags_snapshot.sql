-- ai_design_tags를 '스냅샷' 구조로 전환한다.
-- 기존: (ai_design_id, option_id) 합성 PK + option_id CASCADE → 항목 삭제 시 과거 기록까지 사라짐.
-- 변경: 라벨/정렬을 박아 두고 option_id는 SET NULL → 항목 삭제·변경 후에도 상세에 기록 보존.

ALTER TABLE "ai_design_tags" ADD COLUMN "group_label" text;--> statement-breakpoint
ALTER TABLE "ai_design_tags" ADD COLUMN "option_label" text;--> statement-breakpoint
ALTER TABLE "ai_design_tags" ADD COLUMN "group_sort" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_design_tags" ADD COLUMN "option_sort" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- 기존 행은 현재 태그 분류에서 라벨/정렬을 채운다.
UPDATE "ai_design_tags" adt
SET "option_label" = o."label",
    "group_label" = g."label",
    "option_sort" = o."sort_order",
    "group_sort" = g."sort_order"
FROM "tag_options" o
JOIN "tag_groups" g ON g."id" = o."group_id"
WHERE o."id" = adt."option_id";--> statement-breakpoint

-- 혹시 매칭 안 되는(이미 삭제된) 항목이 있으면 플레이스홀더로 채워 NOT NULL을 만족시킨다.
UPDATE "ai_design_tags" SET "option_label" = '(삭제된 항목)' WHERE "option_label" IS NULL;--> statement-breakpoint
UPDATE "ai_design_tags" SET "group_label" = '(삭제된 구분)' WHERE "group_label" IS NULL;--> statement-breakpoint

ALTER TABLE "ai_design_tags" ALTER COLUMN "group_label" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_design_tags" ALTER COLUMN "option_label" SET NOT NULL;--> statement-breakpoint

-- 합성 PK 제거 → 대리키 id로 교체(option_id가 nullable이 되므로 PK에 쓸 수 없음).
ALTER TABLE "ai_design_tags" DROP CONSTRAINT "ai_design_tags_pk";--> statement-breakpoint
ALTER TABLE "ai_design_tags" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_design_tags" ADD CONSTRAINT "ai_design_tags_pk" PRIMARY KEY ("id");--> statement-breakpoint

-- option_id: CASCADE → SET NULL, nullable 허용.
ALTER TABLE "ai_design_tags" DROP CONSTRAINT "ai_design_tags_option_id_tag_options_fk";--> statement-breakpoint
ALTER TABLE "ai_design_tags" ALTER COLUMN "option_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_design_tags" ADD CONSTRAINT "ai_design_tags_option_id_tag_options_fk" FOREIGN KEY ("option_id") REFERENCES "tag_options"("id") ON DELETE set null;--> statement-breakpoint

CREATE INDEX "ai_design_tags_ai_design_idx" ON "ai_design_tags" ("ai_design_id");
