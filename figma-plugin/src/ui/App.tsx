import { useMemo, useState } from 'react';
import { API_BASE } from './config';
import { createApiClient } from './lib/api';
import { humanize } from './lib/errors';
import { confirmPages, filesMeta, uploadAll } from './lib/upload';
import { useSession } from './hooks/useSession';
import { usePairingLogin } from './hooks/usePairingLogin';
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

  const bridge = useFigmaBridge(session.hydrate);
  const { selectionCount, exportSelection, notify, openUrl } = bridge;

  const runner = useUploadRunner({
    exportSelection,
    notify,
    onBeforeRun: () => setOpenProposalId(null), // hideOpen
  });
  const { busy, status, setStatus, run, runAction } = runner;

  // api 클라이언트는 1회 생성. 토큰은 useSession ref로 항상 최신 읽기.
  // 리프레시까지 실패하면 세션을 비워 로그인 화면으로 되돌린다(만료 토큰으로 멈춰 있지 않게).
  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: API_BASE,
        getTokens: session.getTokens,
        onTokens: session.setTokens,
        onAuthExpired: session.logout,
      }),
    [session.getTokens, session.setTokens, session.logout],
  );

  const pairing = usePairingLogin({ api, openUrl: bridge.openUrl, onSuccess: session.setSession });

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
        <Login
          busy={pairing.busy}
          errorText={pairing.error ? humanize(pairing.error) : ''}
          onLogin={pairing.start}
          onCancel={pairing.cancel}
          onSignup={() => openUrl(API_BASE.replace(/\/+$/, '') + '/signup')}
        />
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
        runAction={runAction}
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
