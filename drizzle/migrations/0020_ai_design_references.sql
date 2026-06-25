CREATE TABLE "ai_design_reference_proposals" (
	"ai_design_id" uuid NOT NULL,
	"proposal_id" uuid,
	"proposal_title" text NOT NULL,
	"image_url" text NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "ai_design_reference_proposals_pk" PRIMARY KEY("ai_design_id","sort_order")
);
--> statement-breakpoint
ALTER TABLE "ai_design_reference_proposals" ADD CONSTRAINT "ai_design_ref_proposals_ai_design_id_fk" FOREIGN KEY ("ai_design_id") REFERENCES "ai_designs"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "ai_design_reference_proposals" ADD CONSTRAINT "ai_design_ref_proposals_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "ai_design_reference_proposals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_design_reference_proposals" FORCE ROW LEVEL SECURITY;
