// One public Supabase Realtime room per proposal, keyed by its public id.
export function channelName(publicId: string): string {
  return `proposal:${publicId}`;
}
