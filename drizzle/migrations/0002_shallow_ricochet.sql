CREATE TABLE "proposal_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"page_order" integer NOT NULL,
	"storage_path" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	CONSTRAINT "proposal_pages_version_order_unique" UNIQUE("version_id","page_order")
);
--> statement-breakpoint
CREATE TABLE "proposal_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_versions_proposal_version_unique" UNIQUE("proposal_id","version_no")
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"title" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"access_password_hash" text,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "proposals_visibility_check" CHECK ("proposals"."visibility" in ('private', 'public'))
);
--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_owner_id_profiles_fk" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_proposals_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_created_by_profiles_fk" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "proposal_pages" ADD CONSTRAINT "proposal_pages_version_id_versions_fk" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_current_version_id_versions_fk" FOREIGN KEY ("current_version_id") REFERENCES "proposal_versions"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "proposals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_pages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_pages" FORCE ROW LEVEL SECURITY;
