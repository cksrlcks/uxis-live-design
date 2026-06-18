import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);
const { data: existing } = await supabase.storage.getBucket("proposals");
if (existing) {
  if (existing.public) {
    console.log("bucket 'proposals' already public");
  } else {
    const { error } = await supabase.storage.updateBucket("proposals", { public: true });
    if (error) throw error;
    console.log("flipped bucket 'proposals' to public");
  }
} else {
  const { error } = await supabase.storage.createBucket("proposals", { public: true });
  if (error) throw error;
  console.log("created public bucket 'proposals'");
}
