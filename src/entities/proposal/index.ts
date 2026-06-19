export { proposalQueries } from "./api/proposal.query";
export { getProposals as fetchProposals } from "./api/get-proposals";
export { getProposalDetail as fetchProposalDetail } from "./api/get-proposal-detail";
export { getViewerVariants as fetchViewerVariants } from "./api/get-viewer-variants";
export type {
  Proposal,
  ProposalPage,
  ViewerVariant,
  EditorVariant,
  ProposalDetailHeader,
  ProposalDetail,
} from "./model/types";
