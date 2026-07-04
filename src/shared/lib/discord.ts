// Discord Webhook 알림. DISCORD_WEBHOOK_URL 미설정 시 조용히 건너뛴다(로컬/CI 안전).
// 백필 스크립트(tsx)와 서버 코드 양쪽에서 쓰므로 server-only를 넣지 않는다.
export async function sendDiscord(content: string): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1900) }), // Discord 2000자 제한 여유
    });
    if (!res.ok) console.error(`[discord] webhook responded ${res.status}`);
  } catch (err) {
    console.error("[discord] send failed:", err instanceof Error ? err.message : err);
  }
}
