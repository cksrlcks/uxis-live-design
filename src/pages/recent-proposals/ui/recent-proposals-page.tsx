"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadRecent, type RecentProposal } from "@/shared/recent/recent-proposals";

export function RecentProposalsPage() {
  // localStorage는 브라우저 전용 → 마운트 후 로드(하이드레이션 안전, identity 패턴과 동일).
  const [items, setItems] = useState<RecentProposal[] | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: localStorage is browser-only
    setItems(loadRecent());
  }, []);

  if (items === null) return null;

  return (
    <div className="bg-background flex min-h-screen flex-col items-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">최근 본 시안</h1>
        {items.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">
            최근 본 시안이 없습니다. 공유받은 링크로 시안을 열어보세요.
          </p>
        ) : (
          <ul className="mt-6 space-y-2">
            {items.map((r) => (
              <li key={r.publicId}>
                <Link
                  href={`/p/${r.publicId}`}
                  className="border-border hover:bg-muted block rounded-[6px] border px-4 py-3 text-sm"
                >
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground mt-8 text-xs">
          편집 권한은 관리자 승인 후 부여됩니다.
        </p>
      </div>
    </div>
  );
}
