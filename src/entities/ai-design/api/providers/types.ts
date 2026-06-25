// HTML 시안 생성 provider 추상화.
// 제공사(OpenAI/Anthropic)별 SDK 차이를 이 인터페이스 뒤로 숨긴다.
// 새 제공사를 추가하려면 이 타입을 구현하고 generate-html.server.ts의 레지스트리에 등록한다.

export type GenerateHtmlRequest = {
  model: string;
  system: string; // 시스템 프롬프트(제공사별로 instructions/system 필드에 매핑)
  userText: string; // 사용자 입력 텍스트
  imageUrls: string[]; // 참고 시안 이미지 URL
  maxOutputTokens: number;
};

export type AiHtmlProvider = {
  // raw 텍스트(코드펜스 미제거)를 반환. 빈 응답이면 빈 문자열을 반환하고 호출측에서 처리한다.
  generate(req: GenerateHtmlRequest): Promise<string>;
};
