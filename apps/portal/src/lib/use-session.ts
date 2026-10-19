import { readActiveWorkspace, type ActiveWorkspace } from '@event/core';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface SessionState {
  loading: boolean;
  session: Session | null;
  workspace: ActiveWorkspace;
}

/** Current Supabase session and the active_workspace carried by its JWT. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    loading: true,
    session: null,
    workspace: readActiveWorkspace(null),
  });

  useEffect(() => {
    let mounted = true;
    const apply = (session: Session | null) => {
      if (mounted) {
        setState({
          loading: false,
          session,
          workspace: readActiveWorkspace(session?.access_token),
        });
      }
    };

    // Try reading session from Supabase
    supabase.auth
      .getSession()
      .then(({ data }) => apply(data?.session ?? null))
      .catch(() => apply(null));

    // Fallback timer: ensure loading never hangs if local Supabase docker is offline
    const timer = setTimeout(() => apply(null), 500);

    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => {
      mounted = false;
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
