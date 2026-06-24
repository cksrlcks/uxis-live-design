import { CovaLogo } from './CovaLogo';

export function Header({
  user,
  onLogout,
}: {
  user: { name?: string; email?: string };
  onLogout: () => void;
}) {
  return (
    <header>
      <CovaLogo className="logo" width={66} height={16} />
      <div className="who">
        <div className="name" id="userName">
          {user.name || ''}
        </div>
        <div className="email" id="userEmail">
          {user.email ? '(' + user.email + ')' : ''}
        </div>
      </div>
      <button className="soft sm" id="logoutBtn" type="button" onClick={onLogout}>
        로그아웃
      </button>
    </header>
  );
}
