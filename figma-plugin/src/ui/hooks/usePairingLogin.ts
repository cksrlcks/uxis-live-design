import { useCallback, useRef, useState } from 'react';
import { API_BASE } from '../config';
import { signInUrl, type ApiClient } from '../lib/api';
import type { SessionConfig } from './useSession';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

type Opts = {
  api: ApiClient;
  openUrl: (url: string) => void;
  onSuccess: (s: SessionConfig) => void;
};

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// 로그인 페어링: uuid 생성 → 외부 브라우저로 사인인 페이지 열기 → uuid로 폴링.
// 성공 시 onSuccess로 세션 전달. 타임아웃/취소 가능. (crypto.randomUUID는 Figma 데스크톱 iframe 제공)
export function usePairingLogin(opts: Opts) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setBusy(false);
  }, []);

  const start = useCallback(async () => {
    setError('');
    setBusy(true);
    cancelRef.current = false;
    try {
      const key = crypto.randomUUID();
      optsRef.current.openUrl(signInUrl(API_BASE, key));

      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (!cancelRef.current && Date.now() < deadline) {
        await delay(POLL_INTERVAL_MS);
        if (cancelRef.current) return;
        let res;
        try {
          res = await optsRef.current.api.pollPairing(key);
        } catch {
          continue; // 일시적 네트워크/서버 오류는 무시하고 계속 폴링
        }
        if ('status' in res) continue; // pending
        optsRef.current.onSuccess({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          expiresAt: res.expiresAt,
          user: res.user,
        });
        setBusy(false);
        return;
      }
      if (!cancelRef.current) setError('OAUTH_TIMEOUT');
    } catch {
      setError('OAUTH_FAILED');
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, start, cancel };
}
