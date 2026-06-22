ALTER TABLE "chat_messages" ADD COLUMN "author_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_id_profiles_fk" FOREIGN KEY ("author_id") REFERENCES "profiles"("id") ON DELETE set null;