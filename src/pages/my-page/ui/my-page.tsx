import { EditNameDialog } from "@/features/auth";

type MyPageProps = {
  displayName: string | null;
  email: string;
  createdAt: Date | string | null;
};

// 카드 내부 콘텐츠 — 페이지 셸(배경·카드)은 AccountPage가 담당한다.
export function MyPage({ displayName, email, createdAt }: MyPageProps) {
  const initial = (displayName ?? email).charAt(0).toUpperCase();
  const joined = createdAt
    ? new Date(createdAt).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="flex flex-col items-center text-center">
      <span
        className="bg-foreground text-background flex size-14 items-center justify-center rounded-full text-xl font-medium"
        aria-hidden="true"
      >
        {initial}
      </span>
      <EditNameDialog displayName={displayName} />
      <p className="text-muted-foreground mt-0.5 truncate text-sm">{email}</p>
      <p className="text-muted-foreground mt-1 text-xs">가입일 {joined}</p>
    </div>
  );
}
