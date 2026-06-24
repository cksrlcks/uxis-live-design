const MSG: Record<string, string> = {
  NETWORK: '서버에 연결할 수 없습니다. 주소와 포트를 확인하세요.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
  FORBIDDEN: '편집 권한이 없습니다.',
  RATE_LIMITED: '요청이 많습니다. 잠시 후 다시 시도하세요.',
  VALIDATION_ERROR: '입력값을 확인하세요(형식/용량 25MB 초과 등).',
  UPLOAD_FAILED: '이미지 업로드에 실패했습니다.',
  UPLOAD_NETWORK: '이미지 업로드 중 네트워크 오류가 발생했습니다.',
  NO_VARIANT: '이 시안에 안(variant)이 없습니다.',
  NO_SELECTION: '내보낼 프레임을 먼저 선택하세요.',
  EXPORT_FAILED: '프레임 내보내기에 실패했습니다.',
  OAUTH_TIMEOUT: '로그인 시간이 초과되었습니다. 다시 시도하세요.',
  OAUTH_FAILED: '로그인에 실패했습니다. 다시 시도하세요.',
};

export function humanize(code: string): string {
  return MSG[code] || '오류: ' + code;
}
