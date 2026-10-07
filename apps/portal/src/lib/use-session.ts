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
    const apply = (session: Session | null) =>
      setState({ loading: false, session, workspace: readActiveWorkspace(session?.access_token) });
    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}
