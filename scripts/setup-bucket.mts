import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const { data: existing } = await supabase.storage.getBucket("proposals");
if (existing) {
  console.log("bucket 'proposals' already exists:", { public: existing.public });
} else {
  const { error } = await supabase.storage.createBucket("proposals", { public: false });
  if (error) throw error;
  console.log("created private bucket 'proposals'");
}
