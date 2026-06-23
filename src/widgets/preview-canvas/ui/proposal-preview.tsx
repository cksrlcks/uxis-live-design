"use client";
import type { ProposalPage } from "@/entities/proposal";
import type { PinContext } from "@/entities/pin";
import { FullscreenSlides } from "./fullscreen-slides";
import { CanvasView } from "./canvas-view";

// 풀화면/캔버스 선택은 부모(public-viewer)가 하단 플로팅 독에서 관리한다.
export function ProposalPreview({
  pages,
  pin,
  view,
  controlsHidden = false,
  whiteboardEnabled = false,
}: {
  pages: ProposalPage[];
  pin?: PinContext;
  view: "fullscreen" | "canvas";
  // 하단 dock이 접혔을 때 캔버스의 일반/코멘트 컨트롤러도 함께 숨긴다.
  controlsHidden?: boolean;
  // 시안별 화이트보드 on/off 설정. 기본 꺼짐.
  whiteboardEnabled?: boolean;
}) {
  return (
    <div className="h-full w-full">
      {view === "fullscreen" ? (
        <FullscreenSlides pages={pages} />
      ) : (
        <CanvasView pages={pages} pin={pin} controlsHidden={controlsHidden} whiteboardEnabled={whiteboardEnabled} />
      )}
    </div>
  );
}
