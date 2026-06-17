import { signup } from "../actions";
import { Button } from "@/legacy/components/ui/button";
import { Input } from "@/legacy/components/ui/input";
import { Label } from "@/legacy/components/ui/label";
import { Card } from "@/legacy/components/ui/card";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight">회원가입</h1>
        <p className="mt-2 text-sm text-muted-foreground">가입 후 관리자 승인이 필요합니다.</p>
        <form action={signup} className="mt-6 space-y-4">
          <div className="space-y-2"><Label htmlFor="name">이름</Label><Input id="name" name="name" type="text" required /></div>
          <div className="space-y-2"><Label htmlFor="email">이메일</Label><Input id="email" name="email" type="email" required /></div>
          <div className="space-y-2"><Label htmlFor="password">비밀번호</Label><Input id="password" name="password" type="password" required minLength={8} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">가입하기</Button>
        </form>
        <a href="/login" className="mt-4 block text-sm underline">이미 계정이 있으신가요? 로그인</a>
      </Card>
    </div>
  );
}
