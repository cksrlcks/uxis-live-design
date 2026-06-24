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
CREATE TABLE "proposal_tags" (
	"proposal_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_tags_pk" PRIMARY KEY("proposal_id","option_id")
);
--> statement-breakpoint
ALTER TABLE "tag_options" ADD CONSTRAINT "tag_options_group_id_tag_groups_fk" FOREIGN KEY ("group_id") REFERENCES "tag_groups"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_tags" ADD CONSTRAINT "proposal_tags_proposal_id_proposals_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_tags" ADD CONSTRAINT "proposal_tags_option_id_tag_options_fk" FOREIGN KEY ("option_id") REFERENCES "tag_options"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_tags" ADD CONSTRAINT "proposal_tags_created_by_profiles_fk" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "proposal_tags_option_idx" ON "proposal_tags" ("option_id");
--> statement-breakpoint
ALTER TABLE "tag_groups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tag_groups" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tag_options" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tag_options" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_tags" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_tags" FORCE ROW LEVEL SECURITY;
