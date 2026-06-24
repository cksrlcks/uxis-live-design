import { CovaLogo } from './CovaLogo';

export function Login({
  busy,
  errorText,
  onLogin,
  onCancel,
  onSignup,
}: {
  busy: boolean;
  errorText: string;
  onLogin: () => void;
  onCancel: () => void;
  onSignup: () => void;
}) {
  return (
    <section id="login">
      <div className="loginbody">
        <CovaLogo className="logo login-logo" width={106} height={26} />
        <h1 className="login-title">로그인</h1>
        <p className="login-sub">브라우저에서 로그인하면 자동으로 연결됩니다</p>

        {busy ? (
          <>
            <button type="button" disabled>
              로그인 중입니다…
            </button>
            <p className="login-sub" style={{ marginTop: 14 }}>
              열린 브라우저에서 로그인을 완료해주세요.
            </p>
            <div className="signup">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onCancel();
                }}
              >
                취소
              </a>
            </div>
          </>
        ) : (
          <button id="loginBtn" type="button" onClick={onLogin}>
            로그인하기
          </button>
        )}

        <div className="err" id="loginErr">
          {errorText}
        </div>

        <div className="signup">
          계정이 없으신가요?{' '}
          <a
            id="signupLink"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onSignup();
            }}
          >
            회원가입
          </a>
        </div>
      </div>
    </section>
  );
}
