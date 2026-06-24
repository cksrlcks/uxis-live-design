import { useCallback, useRef, useState } from 'react';
import type { ExportedImage } from '../../shared/messages';
import { humanize } from '../lib/errors';

export type Status = { text: string; kind: '' | 'err' | 'ok' };
export type SetStatus = (text: string, isErr?: boolean) => void;

export function useUploadRunner(opts: {
  exportSelection: () => Promise<ExportedImage[]>;
  notify: (message: string, error?: boolean) => void;
  onBeforeRun?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatusState] = useState<Status>({ text: '', kind: '' });
  const busyRef = useRef(false);

  const setStatus = useCallback<SetStatus>(
    (text, isErr) => setStatusState({ text: text || '', kind: isErr ? 'err' : '' }),
    [],
  );
  const setStatusOk = useCallback((text: string) => setStatusState({ text, kind: 'ok' }), []);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const run = useCallback(
    async (label: string, fn: (images: ExportedImage[], setStatus: SetStatus) => Promise<void>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      optsRef.current.onBeforeRun?.();
      setStatus(label + ' — 프레임 내보내는 중…');
      try {
        const images = await optsRef.current.exportSelection();
        if (!images.length) throw new Error('NO_SELECTION');
        await fn(images, setStatus);
        setStatusOk(label + ' 완료 ✓');
      } catch (e) {
        const m = humanize(e instanceof Error ? e.message : String(e));
        setStatus(m, true);
        optsRef.current.notify(m, true);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [setStatus, setStatusOk],
  );

  return { busy, status, setStatus, setStatusOk, run };
}
