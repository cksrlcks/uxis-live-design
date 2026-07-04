CREATE TABLE "variant_tags" (
	"variant_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variant_tags_pk" PRIMARY KEY("variant_id","option_id")
);
--> statement-breakpoint
ALTER TABLE "variant_tags" ADD CONSTRAINT "variant_tags_variant_id_proposal_variants_fk" FOREIGN KEY ("variant_id") REFERENCES "proposal_variants"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "variant_tags" ADD CONSTRAINT "variant_tags_option_id_tag_options_fk" FOREIGN KEY ("option_id") REFERENCES "tag_options"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "variant_tags" ADD CONSTRAINT "variant_tags_created_by_profiles_fk" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "variant_tags_option_idx" ON "variant_tags" ("option_id");
--> statement-breakpoint
INSERT INTO "variant_tags" ("variant_id", "option_id", "created_by", "created_at")
SELECT fv.id, pt.option_id, pt.created_by, pt.created_at
FROM "proposal_tags" pt
JOIN LATERAL (
  SELECT pv.id FROM "proposal_variants" pv
  WHERE pv.proposal_id = pt.proposal_id
  ORDER BY pv.sort_order ASC
  LIMIT 1
) fv ON true
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "variant_tags" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "variant_tags" FORCE ROW LEVEL SECURITY;
