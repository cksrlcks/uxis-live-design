CREATE TABLE "proposal_page_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"industry" text,
	"tone" text,
	"style_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"prompt_snippet" text,
	"analysis_version" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"model" text,
	"error_message" text,
	"analyzed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_page_analysis_page_version_unique" UNIQUE("page_id","analysis_version"),
	CONSTRAINT "proposal_page_analysis_status_check" CHECK ("status" in ('pending', 'analyzed', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "proposal_section_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_analysis_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"section_type" text NOT NULL,
	"order_index" integer NOT NULL,
	"layout_type" text,
	"tone" text,
	"background_type" text,
	"color_palette" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"components" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"prompt_snippet" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_section_analysis_section_type_check" CHECK ("section_type" in ('hero','intro','about','service','product','portfolio','gallery','process','pricing','review','faq','contact','cta','footer'))
);
--> statement-breakpoint
ALTER TABLE "proposal_page_analysis" ADD CONSTRAINT "proposal_page_analysis_page_id_proposal_pages_fk" FOREIGN KEY ("page_id") REFERENCES "proposal_pages"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_page_analysis" ADD CONSTRAINT "proposal_page_analysis_proposal_id_proposals_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_page_analysis" ADD CONSTRAINT "proposal_page_analysis_version_id_proposal_versions_fk" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_section_analysis" ADD CONSTRAINT "proposal_section_analysis_page_analysis_id_fk" FOREIGN KEY ("page_analysis_id") REFERENCES "proposal_page_analysis"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_section_analysis" ADD CONSTRAINT "proposal_section_analysis_proposal_id_proposals_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "proposal_page_analysis_proposal_idx" ON "proposal_page_analysis" ("proposal_id");
--> statement-breakpoint
CREATE INDEX "proposal_page_analysis_status_idx" ON "proposal_page_analysis" ("status");
--> statement-breakpoint
CREATE INDEX "proposal_section_analysis_page_idx" ON "proposal_section_analysis" ("page_analysis_id");
--> statement-breakpoint
CREATE INDEX "proposal_section_analysis_section_type_idx" ON "proposal_section_analysis" ("section_type");
--> statement-breakpoint
CREATE INDEX "proposal_section_analysis_proposal_idx" ON "proposal_section_analysis" ("proposal_id");
--> statement-breakpoint
ALTER TABLE "proposal_page_analysis" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_page_analysis" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_section_analysis" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_section_analysis" FORCE ROW LEVEL SECURITY;
