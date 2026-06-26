"use client";

import dynamic from "next/dynamic";

// ogl(WebGL) 번들을 클라이언트에서만 로드한다. ssr:false는 Client Component에서만 허용된다.
const DarkVeil = dynamic(() => import("./DarkVeil"), { ssr: false });

export default DarkVeil;
