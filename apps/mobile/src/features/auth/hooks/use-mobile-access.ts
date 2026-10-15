import { mobileAccess } from '../mobile-access';
import { useAuth } from './auth-context';
import { useAuthActions } from './use-auth-actions';

export function useMobileAccess() {
  const auth = useAuth();
  const actions = useAuthActions();
  return {
    auth,
    actions,
    access: mobileAccess({
      session: auth.session,
      authLoading: auth.loading,
      authError: auth.error,
      membershipPending: actions.workspaces.isPending,
      membershipError: actions.workspaces.error,
      workspaces: actions.workspaces.data,
    }),
  };
}
