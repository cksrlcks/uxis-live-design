import "server-only";
import { getProposalDetail } from "./get-proposal-detail.server";
import { buildOfflinePackagePlan, type OfflinePackagePlan } from "../lib/offline-package";

// 오프라인 패키지 설계도를 만든다. 이미지는 건드리지 않는다 — 브라우저가 URL로 직접 받는다.
// 덕분에 이 함수는 DB 조회 한 번으로 끝나고, 응답도 수십 KB 수준이다.
//
// 담는 범위는 각 안(variant)의 "현재 버전" 페이지만 — 온라인 뷰어의 기본 화면과 같다.
// 버전 히스토리는 담지 않는다(용량이 버전 수만큼 배로 늘어난다).
export async function getOfflinePackagePlan(id: string): Promise<OfflinePackagePlan> {
  // requireEditor()를 포함하므로 권한 검사가 그대로 따라온다.
  const { proposal, variants } = await getProposalDetail(id);
  return buildOfflinePackagePlan(proposal.title, variants);
}
