import { useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { repositories } from '@/lib/repositories';
import { readAuthCallback, type AuthCallbackRouteParams } from '../auth-callback';

export function useAuthCallback(params: AuthCallbackRouteParams) {
  const { code, token_hash: tokenHash, type, error: providerError, error_code: errorCode } = params;
  const url = Linking.useLinkingURL();
  const [error, setError] = useState<unknown>(null);
  const current = useRef<{ key: string; promise: Promise<void> } | null>(null);
  useEffect(() => {
    let alive = true;
    const read = async () => {
      const link = url ?? (await Linking.getInitialURL());
      const callback = readAuthCallback(link, {
        code,
        token_hash: tokenHash,
        type,
        error: providerError,
        error_code: errorCode,
      });
      // Effects can run again while a single-use auth exchange is in flight. Keep the same promise.
      const key = JSON.stringify(callback);
      if (current.current?.key !== key)
        current.current = { key, promise: repositories.auth.acceptCallback(callback) };
      await current.current.promise;
      if (alive) router.replace(callback.type === 'recovery' ? '/auth/reset' : '/workspaces?auto=1');
    };
    void read().catch((e: unknown) => {
      if (alive) setError(e);
    });
    return () => {
      alive = false;
    };
  }, [url, code, tokenHash, type, providerError, errorCode]);
  return error;
}
