import { type Role } from "@/shared/auth/roles";
import { Badge } from "@/shared/ui/badge";
import { PageHeader } from "@/widgets/studio-shell";

const ROLE_LABEL: Record<Role, string> = {
  pending: "승인 대기",
  editor: "에디터",
  admin: "관리자",
};

type MyPageProps = {
  displayName: string | null;
  email: string;
  role: Role;
  createdAt: Date | string | null;
};

export function MyPage({ displayName, email, role, createdAt }: MyPageProps) {
  const name = displayName ?? "사용자";
  const initial = (displayName ?? email).charAt(0).toUpperCase();
  const joined = createdAt
    ? new Date(createdAt).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div>
      <PageHeader eyebrow="계정" title="마이페이지" />

      <div className="bg-card max-w-xl overflow-hidden rounded-lg border">
        <div className="flex items-center gap-4 border-b p-5">
          <span
            className="bg-foreground text-background flex size-14 shrink-0 items-center justify-center rounded-full text-xl font-medium"
            aria-hidden="true"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-medium">{name}</p>
            <p className="text-muted-foreground truncate text-sm">{email}</p>
          </div>
        </div>

        <dl className="divide-y">
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <dt className="text-muted-foreground text-sm">이름</dt>
            <dd className="text-sm font-medium">{name}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <dt className="text-muted-foreground text-sm">이메일</dt>
            <dd className="text-sm font-medium">{email}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <dt className="text-muted-foreground text-sm">역할</dt>
            <dd>
              <Badge variant="neutral">{ROLE_LABEL[role]}</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <dt className="text-muted-foreground text-sm">가입일</dt>
            <dd className="text-sm font-medium">{joined}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
