import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "ko-KR",
  title: "cova 사용 매뉴얼",
  description: "cova 스튜디오·뷰어·Figma 플러그인 사용 안내",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "홈", link: "/" },
      { text: "스튜디오", link: "/studio/" },
      { text: "뷰어", link: "/viewer/" },
      { text: "Figma 플러그인", link: "/plugin/" },
    ],
    sidebar: {
      "/studio/": [
        {
          text: "cova 스튜디오",
          items: [
            { text: "시작하기", link: "/studio/" },
            { text: "시안", link: "/studio/proposals" },
            { text: "시안 상세·버전", link: "/studio/proposal-detail" },
            { text: "태그 설정", link: "/studio/tags" },
            { text: "사용자 관리", link: "/studio/users" },
            { text: "내 계정", link: "/studio/account" },
          ],
        },
      ],
      "/viewer/": [
        {
          text: "cova 뷰어",
          items: [
            { text: "시안 열기", link: "/viewer/" },
            { text: "프리뷰", link: "/viewer/preview" },
            { text: "실시간 회의", link: "/viewer/collaboration" },
            { text: "게스트 이름", link: "/viewer/guest" },
          ],
        },
      ],
      "/plugin/": [
        {
          text: "cova Figma 플러그인",
          items: [
            { text: "소개·설치", link: "/plugin/" },
            { text: "로그인", link: "/plugin/login" },
            { text: "새 시안 만들기", link: "/plugin/new-proposal" },
            { text: "새 버전·새 안 올리기", link: "/plugin/new-version" },
          ],
        },
      ],
    },
    search: { provider: "local" },
    outline: { label: "이 페이지 내용", level: [2, 3] },
    docFooter: { prev: "이전", next: "다음" },
  },
});
