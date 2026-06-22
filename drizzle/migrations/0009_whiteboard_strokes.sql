CREATE TABLE "whiteboard_strokes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"page_order" integer NOT NULL,
	"points" jsonb NOT NULL,
	"color" text NOT NULL,
	"width" real NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"author_color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whiteboard_strokes" ADD CONSTRAINT "whiteboard_strokes_proposal_id_proposals_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "whiteboard_strokes" ADD CONSTRAINT "whiteboard_strokes_variant_id_variants_fk" FOREIGN KEY ("variant_id") REFERENCES "proposal_variants"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "whiteboard_strokes" ADD CONSTRAINT "whiteboard_strokes_version_id_versions_fk" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "whiteboard_strokes" ADD CONSTRAINT "whiteboard_strokes_author_id_profiles_fk" FOREIGN KEY ("author_id") REFERENCES "profiles"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "whiteboard_strokes_variant_version_page_idx" ON "whiteboard_strokes" ("variant_id","version_id","page_order");
--> statement-breakpoint
ALTER TABLE "whiteboard_strokes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "whiteboard_strokes" FORCE ROW LEVEL SECURITY;
