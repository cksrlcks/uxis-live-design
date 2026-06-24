export type ExportedImage = {
  name: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  contentType: string; // "image/png"
};

export type UiToMainMessage =
  | { type: 'ready' }
  | { type: 'save-session'; session: unknown }
  | { type: 'clear-session' }
  | { type: 'export-selection' }
  | { type: 'open-url'; url: string }
  | { type: 'notify'; message: string; error?: boolean }
  | { type: 'close' };

export type MainToUiMessage =
  | { type: 'init'; session: unknown | null }
  | { type: 'selection'; count: number }
  | { type: 'export-result'; images: ExportedImage[] }
  | { type: 'export-error'; message: string };
