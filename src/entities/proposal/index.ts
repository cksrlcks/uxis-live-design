export { proposalQueries } from "./api/proposal.query";
export { getProposals as fetchProposals } from "./api/get-proposals";
export { getProposalDetail as fetchProposalDetail } from "./api/get-proposal-detail";
export type {
  Proposal,
  ProposalPage,
  ViewerVariant,
  EditorVariant,
  ProposalDetailHeader,
  ProposalDetail,
} from "./model/types";
