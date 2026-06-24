import type { MainToUiMessage, UiToMainMessage } from '../../shared/messages';

export function postToMain(msg: UiToMainMessage): void {
  parent.postMessage({ pluginMessage: msg }, '*');
}

export function onMessageFromMain(handler: (msg: MainToUiMessage) => void): () => void {
  const listener = (event: MessageEvent) => {
    const msg = event.data?.pluginMessage as MainToUiMessage | undefined;
    if (!msg) return;
    handler(msg);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
