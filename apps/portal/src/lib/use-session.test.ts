import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthChangeEvent, Session, Subscription } from '@supabase/supabase-js';
import { useSession, type SessionState } from './use-session';
import { supabase } from './supabase';

let hookState: SessionState | undefined;
let hookSetState: ((next: SessionState | ((prev: SessionState) => SessionState)) => void) | undefined;
let hookEffect: (() => void) | undefined;

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: <T>(initial: T) => {
      hookState = initial as unknown as SessionState;
      hookSetState = (next: unknown) => {
        hookState = typeof next === 'function' ? next(hookState) : next;
      };
      return [hookState, hookSetState];
    },
    useEffect: (effect: () => void) => {
      hookEffect = effect;
    },
  };
});

describe('useSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ignores fake ADMIN in localStorage and derives workspace solely from session token', async () => {
    const store: Record<string, string> = {
      tickey_active_workspace: JSON.stringify({ kind: 'ADMIN', orgId: null, roles: ['PLATFORM_ADMIN'] }),
    };
    const localStorageMock = {
      getItem: vi.fn((k: string) => store[k] ?? null),
      setItem: vi.fn((k: string, v: string) => {
        store[k] = v;
      }),
      removeItem: vi.fn((k: string) => {
        delete store[k];
      }),
    };
    vi.stubGlobal('localStorage', localStorageMock);

    const customerPayload = btoa(
      JSON.stringify({
        active_workspace: { kind: 'CUSTOMER' },
      }),
    );
    const fakeToken = `h.${customerPayload}.s`;
    const fakeSession = {
      access_token: fakeToken,
      user: { id: 'user-1' },
    } as unknown as Session;

    let applyCallback: ((event: AuthChangeEvent, s: Session | null) => void) | null = null;
    vi.spyOn(supabase.auth, 'getSession').mockImplementation(() => {
      return Promise.resolve({ data: { session: fakeSession }, error: null });
    });
    vi.spyOn(supabase.auth, 'onAuthStateChange').mockImplementation(
      (cb: (event: AuthChangeEvent, session: Session | null) => void) => {
        applyCallback = cb;
        const sub: Subscription = { unsubscribe: vi.fn(), id: 'sub-1', callback: cb };
        return { data: { subscription: sub } };
      },
    );

    useSession();
    if (hookEffect) {
      hookEffect();
    }
    if (applyCallback) {
      const notify: (event: AuthChangeEvent, s: Session | null) => void = applyCallback;
      notify('SIGNED_IN' as AuthChangeEvent, fakeSession);
    }

    expect(hookState?.workspace.kind).toBe('CUSTOMER');
    expect(hookState?.workspace.roles).toEqual([]);
    expect(hookState?.workspace.orgId).toBeNull();
    expect(localStorageMock.getItem).not.toHaveBeenCalled();
  });
});
