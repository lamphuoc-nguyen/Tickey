import { ApiError, type Workspace } from '@event/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { repositories } from '../../lib/repositories';

const homeOf: Record<Workspace['kind'], string> = { ORG: '/org', ADMIN: '/admin', STAFF: '/', CUSTOMER: '/' };

// MT §4, DB_INSTRUCTIONS §7.1: list memberships, switch, refresh the session, route by workspace.
export function WorkspacePickerPage() {
  const navigate = useNavigate();
  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => repositories.workspace.listMyWorkspaces(),
  });
  const select = useMutation({
    mutationFn: (w: Workspace) => repositories.workspace.setActiveWorkspace(w.kind, w.orgId),
    onSuccess: (_data, w) => navigate(homeOf[w.kind]),
  });

  // The portal serves the Org and Admin workspaces; Customer and Staff live in the mobile apps.
  const portalWorkspaces = workspaces.data?.filter((w) => w.kind === 'ORG' || w.kind === 'ADMIN') ?? [];

  return (
    <main className="page narrow">
      <h1>Chọn không gian làm việc</h1>
      {workspaces.isPending && <p className="muted">Đang tải…</p>}
      {workspaces.isError && <p className="error">Không tải được danh sách workspace.</p>}
      {workspaces.isSuccess && portalWorkspaces.length === 0 && (
        <p className="muted">Tài khoản này không có workspace Org hoặc Admin.</p>
      )}
      <ul className="stack">
        {portalWorkspaces.map((w) => (
          <li key={`${w.kind}-${w.orgId ?? ''}`}>
            <button onClick={() => select.mutate(w)} disabled={select.isPending}>
              {w.kind === 'ADMIN' ? 'Admin nền tảng' : w.orgName}{' '}
              <span className="muted">· {w.roles.join(', ')}</span>
              {w.requiresMfa && <span className="badge">2FA</span>}
            </button>
          </li>
        ))}
      </ul>
      {select.error instanceof ApiError && select.error.code === 'MFA_REQUIRED' && (
        <p className="error">Cần xác thực TOTP trước khi vào workspace này.</p>
      )}
    </main>
  );
}
