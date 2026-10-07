import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '../errors';
import { parseWorkspaces, type Workspace, type WorkspaceKind } from '../models/workspace';

export interface WorkspaceRepository {
  listMyWorkspaces(): Promise<Workspace[]>;
  /** Switches workspace, then refreshes the session so the JWT carries active_workspace. */
  setActiveWorkspace(kind: WorkspaceKind, orgId?: string | null): Promise<void>;
}

export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async listMyWorkspaces(): Promise<Workspace[]> {
    const { data, error } = await this.client.rpc('list_my_workspaces');
    if (error) throw ApiError.fromPostgrest(error);
    return parseWorkspaces(data);
  }

  async setActiveWorkspace(kind: WorkspaceKind, orgId: string | null = null): Promise<void> {
    const { error } = await this.client.rpc('set_active_workspace', { p_kind: kind, p_org_id: orgId });
    if (error) throw ApiError.fromPostgrest(error);
    const { error: refreshError } = await this.client.auth.refreshSession();
    if (refreshError) throw new ApiError('UNAUTHENTICATED', {}, refreshError.message);
  }
}
