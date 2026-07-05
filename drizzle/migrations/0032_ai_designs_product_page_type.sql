ALTER TABLE "ai_designs" DROP CONSTRAINT IF EXISTS "ai_designs_page_type_check";--> statement-breakpoint
ALTER TABLE "ai_designs" ADD CONSTRAINT "ai_designs_page_type_check" CHECK ("page_type" in ('main', 'dashboard', 'subpage', 'product'));
