CREATE TABLE "pin_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"page_order" integer NOT NULL,
	"x_norm" real NOT NULL,
	"y_norm" real NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"author_color" text NOT NULL,
	"body" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pin_comments" ADD CONSTRAINT "pin_comments_proposal_id_proposals_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "pin_comments" ADD CONSTRAINT "pin_comments_variant_id_variants_fk" FOREIGN KEY ("variant_id") REFERENCES "proposal_variants"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "pin_comments" ADD CONSTRAINT "pin_comments_version_id_versions_fk" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "pin_comments" ADD CONSTRAINT "pin_comments_author_id_profiles_fk" FOREIGN KEY ("author_id") REFERENCES "profiles"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "pin_comments_variant_version_page_idx" ON "pin_comments" ("variant_id","version_id","page_order");
--> statement-breakpoint
ALTER TABLE "pin_comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pin_comments" FORCE ROW LEVEL SECURITY;
