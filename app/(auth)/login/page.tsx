import { login } from "../actions";
import { Button } from "@/legacy/components/ui/button";
import { Input } from "@/legacy/components/ui/input";
import { Label } from "@/legacy/components/ui/label";
import { Card } from "@/legacy/components/ui/card";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; returnTo?: string }> }) {
  const { error, returnTo } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        <form action={login} className="mt-6 space-y-4">
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <div className="space-y-2"><Label htmlFor="email">이메일</Label><Input id="email" name="email" type="email" required /></div>
          <div className="space-y-2"><Label htmlFor="password">비밀번호</Label><Input id="password" name="password" type="password" required /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">로그인</Button>
        </form>
        <a href="/signup" className="mt-4 block text-sm underline">계정이 없으신가요? 가입</a>
      </Card>
    </div>
  );
}
