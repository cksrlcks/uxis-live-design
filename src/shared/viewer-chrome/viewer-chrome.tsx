"use client";
import { createContext, useContext, useState } from "react";

// 프리뷰의 '접기' 상태. 하단 컨트롤러(ViewerDock)와 우측 협업 dock(CollaborationDock)이
// 서로 다른 트리(page children vs layout shell)에 있어, 같이 숨기려면 상태를 공유해야 한다.
type ViewerChromeValue = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
};

const ViewerChromeContext = createContext<ViewerChromeValue | null>(null);

export function ViewerChromeProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <ViewerChromeContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </ViewerChromeContext.Provider>
  );
}

// Provider 밖(예: 접근 게이트가 막혀 RealtimeShell이 안 뜬 경우)에서는 로컬 상태로 폴백 →
// 프리뷰 단독 사용 시에도 접기 자체는 동작한다.
export function useViewerChrome(): ViewerChromeValue {
  const ctx = useContext(ViewerChromeContext);
  const [collapsed, setCollapsed] = useState(false);
  return ctx ?? { collapsed, setCollapsed };
}
