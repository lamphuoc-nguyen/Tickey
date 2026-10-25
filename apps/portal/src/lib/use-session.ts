import { readActiveWorkspace, type ActiveWorkspace } from '@event/core';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface SessionState {
  loading: boolean;
  session: Session | null;
  workspace: ActiveWorkspace;
  /** Signed in with the password only, while the user has a verified TOTP factor: the code is still owed. */
  mfaPending: boolean;
}

/** Current Supabase session and the active_workspace carried by its JWT. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    loading: true,
    session: null,
    workspace: readActiveWorkspace(null),
    mfaPending: false,
  });

  useEffect(() => {
    let mounted = true;
    let resolved = false;
    const apply = async (session: Session | null) => {
      resolved = true;
      if (!mounted) return;
      let activeWs = readActiveWorkspace(session?.access_token);
      const savedWs = localStorage.getItem('tickey_active_workspace');
      if (savedWs) {
        try {
          const parsed = JSON.parse(savedWs);
          if (parsed?.kind) {
            activeWs = {
              kind: parsed.kind,
              orgId: parsed.orgId ?? null,
              roles: parsed.roles ?? [],
            };
          }
        } catch {
          void 0;
        }
      }
      if (session && !activeWs.orgId) {
        try {
          const { data } = await supabase.rpc('list_my_workspaces');
          const org = (data as Array<{ kind: string; org_id: string; roles: string[] }>)?.find(
            (w) => w.kind === 'ORG' && w.org_id,
          );
          if (org) {
            activeWs = {
              kind: 'ORG',
              orgId: org.org_id,
              roles: org.roles ?? [],
            };
            localStorage.setItem('tickey_active_workspace', JSON.stringify(activeWs));
          }
        } catch {
          void 0;
        }
      }
      if (mounted) {
        setState({
          loading: false,
          session,
          workspace: activeWs,
          mfaPending: false,
        });
      }
    };

    // Try reading session from Supabase
    supabase.auth
      .getSession()
      .then(({ data }) => apply(data?.session ?? null))
      .catch(() => apply(null));

    // Fallback timer: loading never hangs if Supabase is unreachable, but a slow token refresh is not a sign-out
    const timer = setTimeout(() => {
      if (!resolved) apply(null);
    }, 5000);

    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => {
      mounted = false;
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
