"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { proposalQueries } from "@/entities/proposal";
import { PublicViewer } from "@/widgets/preview-canvas";
import { addRecent } from "@/shared/recent/recent-proposals";

export function PublicViewerPage({
  publicId,
  viewer,
  proposalTitle,
  whiteboardEnabled = false,
  liveMode = true,
}: {
  publicId: string;
  viewer: { id: string } | null;
  proposalTitle: string;
  // 시안별 화이트보드 on/off 설정. 기본 꺼짐.
  whiteboardEnabled?: boolean;
  // 시안별 라이브 모드. 꺼지면 캔버스 협업(핀/화이트보드/코멘트)을 숨긴다. 서버에서도 데이터 거부.
  liveMode?: boolean;
}) {
  useEffect(() => {
    addRecent({ publicId, title: proposalTitle, viewedAt: Date.now() });
  }, [publicId, proposalTitle]);

  const { data: variants, isPending, isError } = useQuery(proposalQueries.viewerVariants(publicId));

  if (isPending)
    return (
      <div role="status" className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground size-8 animate-spin" aria-hidden="true" />
        <span className="sr-only">불러오는 중…</span>
      </div>
    );
  if (isError || !variants)
    return <p className="text-destructive p-6 text-sm">시안을 불러오지 못했습니다.</p>;

  return (
    <PublicViewer
      variants={variants}
      publicId={publicId}
      viewer={viewer}
      proposalTitle={proposalTitle}
      whiteboardEnabled={whiteboardEnabled}
      liveMode={liveMode}
    />
  );
}
