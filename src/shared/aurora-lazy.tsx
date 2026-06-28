"use client";

import dynamic from "next/dynamic";

// ogl(WebGL) 번들을 클라이언트에서만 로드한다. ssr:false는 Client Component에서만 허용된다.
const Aurora = dynamic(() => import("./Aurora"), { ssr: false });

export default Aurora;
