import { redirect } from "next/navigation";
import { storePluginPairing } from "@/features/auth/api/plugin-auth.server";

// 플러그인 로그인 페어링 착지점(외부 브라우저가 연다). 로그인돼 있으면 쿠키 세션의 토큰을 key로 저장하고
// 완료 안내를 띄운다. 미로그인이면 웹 로그인으로 보내고, 로그인 후 returnTo로 이 페이지에 복귀한다.
// 저장은 멱등 upsert이며 이 페이지는 전체 내비게이션으로 1회 도달하므로 렌더 중 저장이 안전하다.
export default async function PluginAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const { k } = await searchParams;
  if (!k) return <Centered title="잘못된 요청" message="페어링 키가 없습니다." />;

  const stored = await storePluginPairing(k);
  if (!stored) redirect(`/login?returnTo=${encodeURIComponent(`/plugin-auth?k=${k}`)}`);

  return (
    <Centered
      title="로그인 완료"
      message="피그마로 돌아가면 자동으로 로그인됩니다. 이 창은 닫아도 됩니다."
    />
  );
}

function Centered({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{message}</p>
      </div>
    </main>
  );
}
