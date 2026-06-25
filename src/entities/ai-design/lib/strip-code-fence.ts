// Claude가 ```html ... ``` 코드펜스로 감싸 응답하는 경우 본문만 추출. 펜스가 없으면 trim.
export function stripCodeFence(s: string): string {
  const trimmed = s.trim();
  const fence = /^```[a-zA-Z]*\n([\s\S]*?)\n?```$/;
  const m = trimmed.match(fence);
  return (m ? m[1] : trimmed).trim();
}
