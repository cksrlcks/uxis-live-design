export const ROLES = { PENDING: "pending", EDITOR: "editor", ADMIN: "admin" } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const isAdmin = (role: Role | null | undefined): boolean => role === ROLES.ADMIN;
export const isEditor = (role: Role | null | undefined): boolean =>
  role === ROLES.EDITOR || role === ROLES.ADMIN;
// Global edit permission: any approved editor/admin may edit all proposals.
export const canEditProposals = (role: Role | null | undefined): boolean => isEditor(role);
