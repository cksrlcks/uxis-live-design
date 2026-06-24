import type { ConfirmPage, FileMeta, Upload } from './upload';

export function variantsPath(pid: string): string {
  return '/api/plugin/proposals/' + pid + '/variants';
}
export function versionsPath(pid: string, vid: string): string {
  return variantsPath(pid) + '/' + vid + '/versions';
}
export function pagesPath(pid: string, vid: string, verId: string): string {
  return versionsPath(pid, vid) + '/' + verId + '/pages';
}

function joinUrl(base: string, path: string): string {
  return String(base).replace(/\/+$/, '') + path;
}

// 외부 브라우저로 열 사인인 URL. 웹 로그인 페이지가 returnTo로 이 페어링 착지점에 복귀시킨다.
export function signInUrl(baseUrl: string, key: string): string {
  return joinUrl(baseUrl, '/plugin-auth?k=' + encodeURIComponent(key));
}

export type User = { name?: string; email?: string; role?: string };
export type Tokens = { accessToken: string | null; refreshToken: string | null };
export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: unknown;
  user: User;
};
export type PairingPollResponse = LoginResponse | { status: 'pending' };
export type ProposalListItem = { id: string; title?: string; domain?: string; publicId?: string };
export type ProposalListResponse = { items?: ProposalListItem[]; total?: number };
export type Page = { id: string; url?: string; width?: number; height?: number };
export type Variant = {
  id: string;
  label?: string;
  slug?: string;
  versions?: unknown[];
  pages?: Page[];
  currentVersionId?: string;
};
export type ProposalDetail = { variants?: Variant[] };
export type CreateProposalResponse = {
  proposalId: string;
  variantId: string;
  versionId: string;
  uploads: Upload[];
};
export type AddVariantResponse = {
  variantId: string;
  versionId: string;
  label: string;
  uploads: Upload[];
};
export type AddVersionResponse = { versionId: string; versionNo: number };
export type IssuePagesResponse = { uploads: Upload[] };
export type ReplaceIssueResponse = { signedUrl: string; path: string };

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(opts: {
  baseUrl: string;
  getTokens: () => Tokens;
  onTokens: (t: { accessToken: string; refreshToken: string; expiresAt: unknown }) => void;
}) {
  const { baseUrl } = opts;

  async function tryRefresh(): Promise<boolean> {
    const { refreshToken } = opts.getTokens();
    if (!refreshToken) return false;
    try {
      const res = await fetch(joinUrl(baseUrl, '/api/plugin/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const j = await res.json();
      opts.onTokens({ accessToken: j.accessToken, refreshToken: j.refreshToken, expiresAt: j.expiresAt });
      return true;
    } catch {
      return false;
    }
  }

  async function request<T>(
    path: string,
    init: { method?: string; body?: string; headers?: Record<string, string> } = {},
    auth = false,
    retried = false,
  ): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const { accessToken } = opts.getTokens();
    if (auth && accessToken) headers['Authorization'] = 'Bearer ' + accessToken;
    if (init.headers) Object.assign(headers, init.headers);

    let res: Response;
    try {
      res = await fetch(joinUrl(baseUrl, path), {
        method: init.method || 'GET',
        headers,
        body: init.body,
      });
    } catch {
      throw new Error('NETWORK');
    }
    // 액세스 토큰 만료(401) → 리프레시 후 1회 재시도.
    if (res.status === 401 && auth && !retried) {
      if (await tryRefresh()) return request<T>(path, init, auth, true);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok) throw new Error((body && body.error) || 'HTTP_' + res.status);
    return body as T;
  }

  return {
    pollPairing: (key: string) =>
      request<PairingPollResponse>('/api/plugin/auth/poll', {
        method: 'POST',
        body: JSON.stringify({ key }),
      }),
    listProposals: (page: number, pageSize: number, q: string) =>
      request<ProposalListResponse>(
        '/api/plugin/proposals?page=' + page + '&pageSize=' + pageSize + '&q=' + encodeURIComponent(q),
        {},
        true,
      ),
    getProposal: (id: string) =>
      request<ProposalDetail>('/api/plugin/proposals/' + id, {}, true),
    createProposal: (title: string, files: FileMeta[]) =>
      request<CreateProposalResponse>(
        '/api/plugin/proposals',
        { method: 'POST', body: JSON.stringify({ title, files }) },
        true,
      ),
    addVariant: (pid: string, files: FileMeta[]) =>
      request<AddVariantResponse>(
        variantsPath(pid),
        { method: 'POST', body: JSON.stringify({ files }) },
        true,
      ),
    addVersion: (pid: string, vid: string, note: string) =>
      request<AddVersionResponse>(
        versionsPath(pid, vid),
        { method: 'POST', body: JSON.stringify({ note }) },
        true,
      ),
    issuePages: (pid: string, vid: string, verId: string, files: FileMeta[]) =>
      request<IssuePagesResponse>(
        pagesPath(pid, vid, verId),
        { method: 'POST', body: JSON.stringify({ files }) },
        true,
      ),
    confirmPages: (pid: string, vid: string, verId: string, pages: ConfirmPage[]) =>
      request<unknown>(
        pagesPath(pid, vid, verId),
        { method: 'PUT', body: JSON.stringify({ pages }) },
        true,
      ),
    replacePageIssue: (
      pid: string,
      vid: string,
      verId: string,
      pageId: string,
      meta: { contentType: string; size: number },
    ) =>
      request<ReplaceIssueResponse>(
        pagesPath(pid, vid, verId) + '/' + pageId + '/replace',
        { method: 'POST', body: JSON.stringify(meta) },
        true,
      ),
    confirmPageReplace: (
      pid: string,
      vid: string,
      verId: string,
      pageId: string,
      meta: { path: string; width: number; height: number },
    ) =>
      request<unknown>(
        pagesPath(pid, vid, verId) + '/' + pageId,
        { method: 'PUT', body: JSON.stringify(meta) },
        true,
      ),
  };
}
