CREATE TABLE "plugin_auth_pairings" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_tags" (
	"proposal_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_tags_proposal_id_option_id_pk" PRIMARY KEY("proposal_id","option_id")
);
--> statement-breakpoint
CREATE TABLE "tag_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_groups_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tag_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_options_group_code_unique" UNIQUE("group_id","code")
);
--> statement-breakpoint
CREATE TABLE "whiteboard_strokes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"page_order" integer NOT NULL,
	"author_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"author_color" text NOT NULL,
	"strokes" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whiteboard_strokes_author_page_uq" UNIQUE("author_id","variant_id","version_id","page_order")
);
--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "participants" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "figma_url" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "whiteboard_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "exposed_to_uxisworks" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "proposal_tags_option_idx" ON "proposal_tags" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "whiteboard_strokes_variant_version_page_idx" ON "whiteboard_strokes" USING btree ("variant_id","version_id","page_order");