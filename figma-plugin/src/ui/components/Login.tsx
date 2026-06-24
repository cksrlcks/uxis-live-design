import { useState } from 'react';
import { CovaLogo } from './CovaLogo';

export function Login({
  busy,
  errorText,
  onSubmit,
  onSignup,
}: {
  busy: boolean;
  errorText: string;
  onSubmit: (email: string, password: string) => void;
  onSignup: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => onSubmit(email.trim(), password);

  return (
    <section id="login">
      <div className="loginbody">
        <CovaLogo className="logo login-logo" width={106} height={26} />
        <h1 className="login-title">로그인</h1>
        <p className="login-sub">가입하신 이메일로 로그인해주세요</p>

        <label htmlFor="email">이메일</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="6자 이상"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />

        <button id="loginBtn" type="button" disabled={busy} onClick={submit}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
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
