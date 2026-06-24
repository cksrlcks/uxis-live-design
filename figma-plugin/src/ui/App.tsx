import { useMemo, useState } from 'react';
import { API_BASE } from './config';
import { createApiClient } from './lib/api';
import { humanize } from './lib/errors';
import { confirmPages, filesMeta, uploadAll } from './lib/upload';
import { useSession, type SessionConfig } from './hooks/useSession';
import { useFigmaBridge } from './hooks/useFigmaBridge';
import { useUploadRunner } from './hooks/useUploadRunner';
import { CovaLogoSymbol } from './components/CovaLogo';
import { Login } from './components/Login';
import { Header } from './components/Header';
import { SelectionBar } from './components/SelectionBar';
import { Tabs } from './components/Tabs';
import { StatusBar } from './components/StatusBar';
import { NewProposalView } from './components/NewProposalView';
import { ExistingView } from './components/ExistingView';

export function App() {
  const session = useSession();
  const { config, isAuthed, isEditor } = session;

  const [tab, setTab] = useState<'new' | 'existing'>('new');
  const [openProposalId, setOpenProposalId] = useState<string | null>(null);
  const [createKey, setCreateKey] = useState(0);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginErr, setLoginErr] = useState('');

  const bridge = useFigmaBridge(session.hydrate);
  const { selectionCount, exportSelection, notify, openUrl } = bridge;

  const runner = useUploadRunner({
    exportSelection,
    notify,
    onBeforeRun: () => setOpenProposalId(null), // hideOpen
  });
  const { busy, status, setStatus, run } = runner;

  // api 클라이언트는 1회 생성. 토큰은 useSession ref로 항상 최신 읽기.
  const api = useMemo(
    () => createApiClient({ baseUrl: API_BASE, getTokens: session.getTokens, onTokens: session.setTokens }),
    [session.getTokens, session.setTokens],
  );

  /* ── 로그인 ── */
  async function doLogin(email: string, password: string) {
    setLoginErr('');
    if (!email || !password) {
      setLoginErr('이메일과 비밀번호를 입력하세요.');
      return;
    }
    setLoginBusy(true);
    try {
      const data = await api.login(email, password);
      const next: SessionConfig = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        user: data.user,
      };
      session.setSession(next);
    } catch (e) {
      setLoginErr(humanize(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoginBusy(false);
    }
  }

  function doLogout() {
    session.logout();
    setStatus('');
    setOpenProposalId(null);
    setTab('new');
  }

  /* ── 새 시안 ── */
  async function onCreate(title: string) {
    if (!title) {
      setStatus('제목을 입력하세요.', true);
      return;
    }
    await run('새 시안 생성', async (images, setStatus2) => {
      const created = await api.createProposal(title, filesMeta(images));
      await uploadAll(created.uploads, images, (d, t) => setStatus2('업로드 중 ' + d + '/' + t + '…'));
      await api.confirmPages(
        created.proposalId,
        created.variantId,
        created.versionId,
        confirmPages(created.uploads, images),
      );
      notify('새 시안 “' + title + '” 생성됨');
      setCreateKey((k) => k + 1); // 제목 입력 리셋
      setOpenProposalId(created.proposalId);
    });
  }

  if (!isAuthed) {
    return (
      <>
        <CovaLogoSymbol />
        <Login busy={loginBusy} errorText={loginErr} onSubmit={doLogin} onSignup={() => openUrl(API_BASE.replace(/\/+$/, '') + '/signup')} />
      </>
    );
  }

  const user = config.user || {};
  return (
    <>
      <CovaLogoSymbol />
      <Header user={user} onLogout={doLogout} />
      {!isEditor && (
        <div className="warn" id="roleWarn">
          편집 권한이 없는 계정입니다. 업로드가 막힙니다.
        </div>
      )}
      <SelectionBar count={selectionCount} />
      <Tabs tab={tab} onChange={setTab} />

      <NewProposalView
        visible={tab === 'new'}
        busy={busy}
        selectionCount={selectionCount}
        resetKey={createKey}
        onCreate={onCreate}
      />
      <ExistingView
        visible={tab === 'existing'}
        active={tab === 'existing'}
        api={api}
        run={run}
        busy={busy}
        selectionCount={selectionCount}
        notify={notify}
        onUploaded={setOpenProposalId}
        reloadKey={createKey}
      />

      <StatusBar
        status={status}
        openVisible={!!openProposalId}
        onOpen={() => {
          if (openProposalId)
            openUrl(API_BASE.replace(/\/+$/, '') + '/studio/proposals/' + openProposalId);
        }}
      />
    </>
  );
}
