import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, type Workspace } from '@event/core';
import { repositories } from '../../lib/repositories';

interface MutationOptionsMock {
  mutationFn: (w: Workspace) => Promise<void>;
  onSuccess?: (data: unknown, w: Workspace) => void;
  onError?: (err: unknown) => void;
}

let capturedMutationOptions: MutationOptionsMock | undefined;
const mockNavigate = vi.fn();
const mockShowToast = vi.fn();

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../components/common/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
  ToastViewport: () => null,
}));

vi.mock('../../components/common/TickeyLogo', () => ({
  TickeyLogo: () => null,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
  useQuery: () => ({ data: [], isPending: false, isError: false }),
  useMutation: (options: MutationOptionsMock) => {
    capturedMutationOptions = options;
    return {
      mutate: (w: Workspace) =>
        options
          .mutationFn(w)
          .then((res: unknown) => options.onSuccess?.(res, w))
          .catch((err: unknown) => options.onError?.(err)),
      mutateAsync: (w: Workspace) =>
        options.mutationFn(w).then((res: unknown) => {
          options.onSuccess?.(res, w);
          return res;
        }),
      isPending: false,
      error: null,
    };
  },
}));

import { WorkspacePickerPage } from './WorkspacePickerPage';

describe('WorkspacePickerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not navigate when setActiveWorkspace throws an error (e.g. MFA_REQUIRED)', async () => {
    vi.spyOn(repositories.workspace, 'setActiveWorkspace').mockRejectedValue(
      new ApiError('MFA_REQUIRED', {}, 'MFA_REQUIRED'),
    );

    WorkspacePickerPage();
    expect(capturedMutationOptions).toBeDefined();

    const targetWorkspace: Workspace = {
      kind: 'ORG',
      orgId: 'org-123',
      roles: ['OWNER'],
      orgName: 'Nhà hát Ánh Trăng',
      orgStatus: 'APPROVED',
      requiresMfa: true,
    };

    // Trigger select mutation
    await expect(capturedMutationOptions?.mutationFn(targetWorkspace)).rejects.toThrow();

    // Verify navigate was NOT called
    expect(mockNavigate).not.toHaveBeenCalled();

    // Verify onError shows toast
    capturedMutationOptions?.onError?.(new ApiError('MFA_REQUIRED', {}, 'MFA_REQUIRED'));
    expect(mockShowToast).toHaveBeenCalled();
  });

  it('navigates to destination on successful workspace selection', async () => {
    vi.spyOn(repositories.workspace, 'setActiveWorkspace').mockResolvedValue(undefined);

    WorkspacePickerPage();
    const targetWorkspace: Workspace = {
      kind: 'ORG',
      orgId: 'org-123',
      roles: ['OWNER'],
      orgName: 'Nhà hát Ánh Trăng',
      orgStatus: 'APPROVED',
      requiresMfa: false,
    };

    await capturedMutationOptions?.mutationFn(targetWorkspace);
    capturedMutationOptions?.onSuccess?.(undefined, targetWorkspace);

    expect(mockNavigate).toHaveBeenCalledWith('/org');
  });
});
