ALTER TABLE "proposals" ADD COLUMN "domain" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_domain_unique" UNIQUE("domain");