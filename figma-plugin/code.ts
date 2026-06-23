// cova Figma 플러그인 — 메인(샌드박스) 코드.
//
// 네트워크 요청은 UI(iframe)에서 수행한다. iframe은 null origin 이라 대상 API가
// `Access-Control-Allow-Origin: *` 를 줘야 하는데, cova `/api/plugin/*` 가 그렇게 응답한다.
// 메인은 figma API 접근과 세션(토큰) 영속화(clientStorage)만 담당하고, UI와는
// postMessage 로만 통신한다.

const SESSION_KEY = "cova.session";

// UI 가 메인에 보내는 메시지 형태.
type UiMessage =
  | { type: "save-session"; session: unknown }
  | { type: "clear-session" }
  | { type: "resize"; width: number; height: number }
  | { type: "notify"; message: string; error?: boolean }
  | { type: "close" };

figma.showUI(__html__, { width: 380, height: 580, themeColors: true });

// 플러그인이 열리면 저장된 세션을 UI 로 전달한다(없으면 null → 로그인 화면).
(async () => {
  const session = await figma.clientStorage.getAsync(SESSION_KEY);
  figma.ui.postMessage({ type: "init", session: session ?? null });
})();

figma.ui.onmessage = async (msg: UiMessage) => {
  switch (msg.type) {
    case "save-session":
      await figma.clientStorage.setAsync(SESSION_KEY, msg.session);
      break;
    case "clear-session":
      await figma.clientStorage.deleteAsync(SESSION_KEY);
      break;
    case "resize":
      figma.ui.resize(Math.round(msg.width), Math.round(msg.height));
      break;
    case "notify":
      figma.notify(msg.message, { error: msg.error });
      break;
    case "close":
      figma.closePlugin();
      break;
  }
};
