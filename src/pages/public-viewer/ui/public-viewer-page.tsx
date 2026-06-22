"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { PublicViewer } from "@/widgets/preview-canvas";
import { addRecent } from "@/shared/recent/recent-proposals";

export function PublicViewerPage({
  publicId,
  viewer,
  proposalTitle,
}: {
  publicId: string;
  viewer: { id: string } | null;
  proposalTitle: string;
}) {
  useEffect(() => {
    addRecent({ publicId, title: proposalTitle, viewedAt: Date.now() });
  }, [publicId, proposalTitle]);

  const { data: variants, isPending, isError } = useQuery(proposalQueries.viewerVariants(publicId));

  if (isPending) return <p className="text-muted-foreground p-6 text-sm">불러오는 중…</p>;
  if (isError || !variants)
    return <p className="text-destructive p-6 text-sm">시안을 불러오지 못했습니다.</p>;

  return (
    <PublicViewer
      variants={variants}
      publicId={publicId}
      viewer={viewer}
      proposalTitle={proposalTitle}
    />
  );
}
