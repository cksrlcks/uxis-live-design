// cova Figma 플러그인 — 메인(샌드박스) 코드.
//
// 네트워크 요청은 UI(iframe)에서 수행한다. iframe은 null origin 이라 대상 API가
// `Access-Control-Allow-Origin: *` 를 줘야 하는데, cova `/api/plugin/*` 가 그렇게 응답한다.
// 메인은 figma API(선택 export, clientStorage)만 담당하고 UI와는 postMessage 로만 통신한다.

const SESSION_KEY = "cova.session";
const EXPORT_SCALE = 2; // 2x PNG(레티나). 아주 큰 프레임은 백엔드 25MB 제한에 걸릴 수 있다.

// UI 가 메인에 보내는 메시지 형태.
type UiMessage =
  | { type: "ready" }
  | { type: "save-session"; session: unknown }
  | { type: "clear-session" }
  | { type: "export-selection" }
  | { type: "notify"; message: string; error?: boolean }
  | { type: "close" };

figma.showUI(__html__, { width: 400, height: 600, themeColors: true });

// export 가능한(이미지로 뽑을 수 있는) 선택 노드만 추린다.
function exportableSelection(): SceneNode[] {
  return figma.currentPage.selection.filter((n): n is SceneNode => "exportAsync" in n);
}

function postSelection() {
  figma.ui.postMessage({ type: "selection", count: exportableSelection().length });
}
figma.on("selectionchange", postSelection);

// PNG 바이트에서 정확한 픽셀 크기를 읽는다(IHDR: width@16, height@20, big-endian).
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const u32 = (o: number) =>
    ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  return { width: u32(16), height: u32(20) };
}

// 선택된 노드들을 순서대로 PNG 로 내보낸다.
async function exportSelection() {
  const images = [];
  for (const node of exportableSelection()) {
    const bytes = await node.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: EXPORT_SCALE },
    });
    const { width, height } = pngSize(bytes);
    images.push({ name: node.name, bytes, width, height, contentType: "image/png" });
  }
  return images;
}

figma.ui.onmessage = async (msg: UiMessage) => {
  switch (msg.type) {
    case "ready": {
      const session = await figma.clientStorage.getAsync(SESSION_KEY);
      figma.ui.postMessage({ type: "init", session: session ?? null });
      postSelection();
      break;
    }
    case "save-session":
      await figma.clientStorage.setAsync(SESSION_KEY, msg.session);
      break;
    case "clear-session":
      await figma.clientStorage.deleteAsync(SESSION_KEY);
      break;
    case "export-selection": {
      try {
        const images = await exportSelection();
        figma.ui.postMessage({ type: "export-result", images });
      } catch (e) {
        figma.ui.postMessage({
          type: "export-error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
      break;
    }
    case "notify":
      figma.notify(msg.message, { error: msg.error });
      break;
    case "close":
      figma.closePlugin();
      break;
  }
};
