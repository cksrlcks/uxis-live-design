CREATE TABLE "ai_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"company" text,
	"page_type" text NOT NULL,
	"extra_notes" text,
	"status" text DEFAULT 'working' NOT NULL,
	"html" text,
	"error_message" text,
	"model" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_designs_page_type_check" CHECK ("page_type" in ('main', 'dashboard', 'subpage')),
	CONSTRAINT "ai_designs_status_check" CHECK ("status" in ('working', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "ai_design_tags" (
	"ai_design_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	CONSTRAINT "ai_design_tags_pk" PRIMARY KEY("ai_design_id","option_id")
);
--> statement-breakpoint
ALTER TABLE "ai_design_tags" ADD CONSTRAINT "ai_design_tags_ai_design_id_ai_designs_fk" FOREIGN KEY ("ai_design_id") REFERENCES "ai_designs"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "ai_design_tags" ADD CONSTRAINT "ai_design_tags_option_id_tag_options_fk" FOREIGN KEY ("option_id") REFERENCES "tag_options"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "ai_designs" ADD CONSTRAINT "ai_designs_created_by_profiles_fk" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "ai_designs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_designs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_design_tags" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_design_tags" FORCE ROW LEVEL SECURITY;
