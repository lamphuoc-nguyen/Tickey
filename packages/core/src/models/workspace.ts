import { z } from 'zod';

// Shape of public.list_my_workspaces() (MT §4, DB_INSTRUCTIONS §7.1).
export const WORKSPACE_KINDS = ['CUSTOMER', 'ORG', 'STAFF', 'ADMIN'] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

const workspaceJson = z.object({
  kind: z.enum(WORKSPACE_KINDS),
  org_id: z.string().optional(),
  org_name: z.string().optional(),
  org_status: z.string().optional(),
  roles: z.array(z.string()).optional(),
  requires_mfa: z.boolean(),
});

export interface Workspace {
  kind: WorkspaceKind;
  orgId: string | null;
  orgName: string | null;
  orgStatus: string | null;
  roles: string[];
  /** Enrol / verify TOTP before switching, otherwise sensitive RPCs return MFA_REQUIRED. */
  requiresMfa: boolean;
}

export function parseWorkspaces(data: unknown): Workspace[] {
  return z
    .array(workspaceJson)
    .parse(data)
    .map((w) => ({
      kind: w.kind,
      orgId: w.org_id ?? null,
      orgName: w.org_name ?? null,
      orgStatus: w.org_status ?? null,
      roles: w.roles ?? [],
      requiresMfa: w.requires_mfa,
    }));
}

/** active_workspace claim written by public.custom_access_token_hook. */
export interface ActiveWorkspace {
  kind: WorkspaceKind;
  orgId: string | null;
  roles: string[];
}

/**
 * Reads active_workspace from an access token, for routing only: hiding a screen is UX,
 * the server still checks every RPC (MT §4, §21.3). Falls back to CUSTOMER.
 */
export function readActiveWorkspace(accessToken: string | null | undefined): ActiveWorkspace {
  const fallback: ActiveWorkspace = { kind: 'CUSTOMER', orgId: null, roles: [] };
  const payload = accessToken?.split('.')[1];
  if (!payload) return fallback;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claim = (
      JSON.parse(json) as { active_workspace?: { kind?: string; org_id?: string; roles?: string[] } }
    ).active_workspace;
    if (!claim?.kind || !(WORKSPACE_KINDS as readonly string[]).includes(claim.kind)) return fallback;
    return { kind: claim.kind as WorkspaceKind, orgId: claim.org_id ?? null, roles: claim.roles ?? [] };
  } catch {
    return fallback;
  }
}
