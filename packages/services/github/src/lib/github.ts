import { createAppAuth } from '@octokit/auth-app';
import type { AppAuthentication } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

let authInstance: AppAuthentication | undefined;
// Global caches (module-scoped)
const installationIdCache = new Map<string, number>(); // key: "owner/repo" -> installationId
const installationTokenCache = new Map<
  number,
  { token: string; expiresAt: string } // ISO string
>();

export async function getGithubAuth() {
  if (!authInstance) {
    // Decode the base64 key once at startup
    const privateKey = Buffer.from(
      process.env.GITHUB_PRIVATE_KEY!,
      'base64'
    ).toString('utf8');

    const auth = createAppAuth({
      appId: parseInt(process.env.GITHUB_APP_ID!, 10),
      privateKey,
      clientId: process.env.GITHUB_APP_CLIENT_ID!,
      clientSecret: process.env.GITHUB_APP_CLIENT_SECRET!,
    });
    authInstance = await auth({ type: 'app' });
  }

  return authInstance as AppAuthentication;
}

function needsRefresh(
  expiresAtISO: string | undefined,
  skewSeconds: number
): boolean {
  if (!expiresAtISO) return true;
  const now = Date.now();
  const expiryMs = Date.parse(expiresAtISO);
  return now >= expiryMs - skewSeconds * 1000;
}

/**
 * Returns an Octokit authenticated for the installation that has access to {owner}/{repo}.
 * Caches installation id and token; refreshes token on expiry (with skew).
 */
export async function getInstallationOctokit(params: {
  owner: string;
  repo: string;
  refreshSkewSeconds?: number; // default 60s
}): Promise<{
  octokit: Octokit;
  installationId: number;
  tokenExpiresAt: string;
}> {
  const { owner, repo, refreshSkewSeconds = 60 } = params;

  // App JWT (cached by your getGithubAuth)
  const appAuth = await getGithubAuth();
  const appOctokit = new Octokit({ auth: appAuth.token });

  // Installation id (cached)
  const cacheKey = `${owner}/${repo}`;
  let installationId = installationIdCache.get(cacheKey);
  if (!installationId) {
    const { data: installation } = await appOctokit.apps.getRepoInstallation({
      owner,
      repo,
    });
    installationId = installation.id;
    installationIdCache.set(cacheKey, installationId);
  }

  // Token (cached + refresh on expiry with skew)
  const cached = installationTokenCache.get(installationId);
  if (!cached || needsRefresh(cached.expiresAt, refreshSkewSeconds)) {
    const { data: iat } = await appOctokit.apps.createInstallationAccessToken({
      installation_id: installationId,
    });
    installationTokenCache.set(installationId, {
      token: iat.token,
      expiresAt: iat.expires_at,
    });
  }

  const current = installationTokenCache.get(installationId)!;
  const octokit = new Octokit({ auth: current.token });

  return {
    octokit,
    installationId,
    tokenExpiresAt: current.expiresAt,
  };
}

/**
 * Read a file from a repo (uses App JWT -> Installation token exchange inline).
 */
export async function getFile(params: {
  owner: string;
  repo: string;
  path: string;
  ref?: string; // branch/tag/SHA
}) {
  const { owner, repo, path, ref } = params;

  // get the isntallation scoped token so we can manuipulate files
  const { octokit } = await getInstallationOctokit({ owner, repo });

  const res = await octokit.repos.getContent({ owner, repo, path, ref });

  if (
    !Array.isArray(res.data) &&
    res.data.type === 'file' &&
    'content' in res.data
  ) {
    const raw = res.data.content ?? '';
    const buffer =
      res.data.encoding === 'base64'
        ? Buffer.from(raw, 'base64')
        : Buffer.from(raw, (res.data.encoding as BufferEncoding) ?? 'utf8');

    return {
      sha: res.data.sha,
      size: res.data.size,
      encoding: res.data.encoding,
      content: buffer, // Buffer with file contents
      path: res.data.path,
    };
  }

  throw new Error(
    `Path ${path} not found in repo ${owner}/${repo} or is not a file.`
  );
}

/**
 * Create or update a file (commit to repo).
 * - If `sha` is provided -> update
 * - If `sha` is omitted -> create
 */
export async function checkinFile(params: {
  owner: string;
  repo: string;
  path: string;
  message: string;
  content: string | Buffer; // raw content, will be base64-encoded
  branch?: string;
  sha?: string; // required for updates
  committer?: { name: string; email: string };
  author?: { name: string; email: string };
}) {
  const {
    owner,
    repo,
    path,
    message,
    content,
    branch,
    sha,
    committer,
    author,
  } = params;

  const { octokit } = await getInstallationOctokit({ owner, repo });

  const base64Content =
    typeof content === 'string'
      ? Buffer.from(content, 'utf8').toString('base64')
      : Buffer.from(content).toString('base64');

  const res = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: base64Content,
    branch,
    sha, // include for update; omit for create
    committer,
    author,
  });

  return {
    content: {
      path: res.data.content?.path,
      sha: res.data.content?.sha,
      size: res.data.content?.size,
      url: res.data.content?.html_url,
    },
    commit: {
      sha: res.data.commit.sha,
      url: res.data.commit.html_url,
    },
  };
}
