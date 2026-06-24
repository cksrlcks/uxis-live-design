import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExportedImage } from '../../shared/messages';
import { onMessageFromMain, postToMain } from '../lib/messaging';

export function useFigmaBridge(onInit: (session: unknown | null) => void) {
  const [selectionCount, setSelectionCount] = useState(0);
  const pending = useRef<{ resolve: (i: ExportedImage[]) => void; reject: (e: Error) => void } | null>(
    null,
  );
  const onInitRef = useRef(onInit);
  onInitRef.current = onInit;

  useEffect(() => {
    const off = onMessageFromMain((msg) => {
      if (msg.type === 'init') {
        onInitRef.current(msg.session);
      } else if (msg.type === 'selection') {
        setSelectionCount(msg.count || 0);
      } else if (msg.type === 'export-result') {
        pending.current?.resolve(msg.images || []);
        pending.current = null;
      } else if (msg.type === 'export-error') {
        pending.current?.reject(new Error('EXPORT_FAILED'));
        pending.current = null;
      }
    });
    // 핸들러 등록이 끝났으니 메인에 저장된 세션을 요청한다(race 방지 pull).
    postToMain({ type: 'ready' });
    return off;
  }, []);

  const exportSelection = useCallback(
    () =>
      new Promise<ExportedImage[]>((resolve, reject) => {
        pending.current = { resolve, reject };
        postToMain({ type: 'export-selection' });
      }),
    [],
  );

  const notify = useCallback(
    (message: string, error?: boolean) => postToMain({ type: 'notify', message, error }),
    [],
  );
  const openUrl = useCallback((url: string) => postToMain({ type: 'open-url', url }), []);
  const close = useCallback(() => postToMain({ type: 'close' }), []);

  return { selectionCount, exportSelection, notify, openUrl, close };
}
