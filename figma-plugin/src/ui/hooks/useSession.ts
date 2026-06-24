import { useCallback, useRef, useState } from 'react';
import { postToMain } from '../lib/messaging';
import type { Tokens, User } from '../lib/api';

export type SessionConfig = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: unknown;
  user: User | null;
};

const EMPTY: SessionConfig = { accessToken: null, refreshToken: null, expiresAt: null, user: null };

export function useSession() {
  const [config, setConfig] = useState<SessionConfig>(EMPTY);
  const ref = useRef(config);
  ref.current = config;

  const persist = useCallback((next: SessionConfig) => {
    postToMain({ type: 'save-session', session: next });
  }, []);

  // init 수신 시: 저장된 세션을 현재 config에 머지.
  const hydrate = useCallback((session: unknown | null) => {
    if (session) setConfig((prev) => ({ ...prev, ...(session as Partial<SessionConfig>) }));
  }, []);

  // 로그인 성공: 전체 세션 교체 + persist.
  const setSession = useCallback(
    (next: SessionConfig) => {
      setConfig(next);
      persist(next);
    },
    [persist],
  );

  // 401 리프레시 성공: 토큰만 갱신 + persist.
  const setTokens = useCallback(
    (t: { accessToken: string; refreshToken: string; expiresAt: unknown }) => {
      setConfig((prev) => {
        const next = { ...prev, ...t };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const logout = useCallback(() => {
    setConfig(EMPTY);
    postToMain({ type: 'clear-session' });
  }, []);

  // api 클라이언트가 항상 최신 토큰을 읽도록 ref 기반 getter.
  const getTokens = useCallback(
    (): Tokens => ({ accessToken: ref.current.accessToken, refreshToken: ref.current.refreshToken }),
    [],
  );

  const isAuthed = !!(config.accessToken && config.user);
  const isEditor = config.user?.role === 'editor' || config.user?.role === 'admin';

  return { config, isAuthed, isEditor, getTokens, setTokens, setSession, hydrate, logout };
}
