/**
 * E2E-ish tests that hit GitHub using your App credentials.
 * Requirements:
 * - process.env.GITHUB_PRIVATE_KEY (base64), GITHUB_APP_ID, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET
 * - process.env.GITHUB_REPO_OWNER, GITHUB_REPO_NAME
 *
 * IMPORTANT:
 * - Export `getInstallationOctokit` from your github module so this test can import it.
 * - The write test only runs if ALLOW_GH_WRITES=1 to avoid accidental commits.
 */

import { getGithubAuth, getFile, checkinFile, getInstallationOctokit } from "./github";

const OWNER = process.env.GITHUB_REPO_OWNER!;
const REPO = process.env.GITHUB_REPO_NAME!;
const ALLOW_WRITES = process.env.E2E === "true";

const itIf = (cond: boolean) => (cond ? it : it.skip);
const describeIf = (cond: boolean) => (cond ? describe : describe.skip);

describe("preconditions", () => {
  it("has required env vars", () => {
    expect(OWNER).toBeTruthy();
    expect(REPO).toBeTruthy();
  });
});

describe("getGithubAuth", () => {
  it("creates and caches a single auth instance", async () => {
    const auth1 = await getGithubAuth();
    const auth2 = await getGithubAuth();

    // ✅ Both calls return the same instance (singleton behavior)
    expect(auth1).toBe(auth2);

    // ✅ It should auth
    expect(auth1).toHaveProperty("token");
    expect(auth1).toHaveProperty("expiresAt");
    expect(auth1).toHaveProperty("type");
    expect(auth1).toHaveProperty("appId");

    expect(auth2).toHaveProperty("token");
    expect(auth2).toHaveProperty("expiresAt");
    expect(auth2).toHaveProperty("type");
    expect(auth2).toHaveProperty("appId");

    expect(auth1.token).toBe(auth2.token);
    expect(auth1.expiresAt).toBe(auth2.expiresAt);
    expect(auth1.type).toBe(auth2.type);
    expect(auth1.appId).toBe(auth2.appId);
  });
});

describe("getInstallationOctokit", () => {
  it("returns an installation-scoped Octokit and caches token until near expiry", async () => {
    const first = await getInstallationOctokit({ owner: OWNER, repo: REPO, refreshSkewSeconds: 30 });
    expect(first).toHaveProperty("octokit");
    expect(first).toHaveProperty("installationId");
    expect(typeof first.installationId).toBe("number");
    expect(first).toHaveProperty("tokenExpiresAt");
    expect(typeof first.tokenExpiresAt).toBe("string");

    // Call again; should hit caches (same installationId, same expiresAt as long as not within skew)
    const second = await getInstallationOctokit({ owner: OWNER, repo: REPO, refreshSkewSeconds: 30 });
    expect(second.installationId).toBe(first.installationId);

    // tokens minted are opaque; we assert that the cached expiry sticks unless near skew window
    // If it refreshed due to timing, these may differ — so we allow equality OR later time.
    const t1 = Date.parse(first.tokenExpiresAt);
    const t2 = Date.parse(second.tokenExpiresAt);
    expect(Number.isFinite(t1)).toBe(true);
    expect(Number.isFinite(t2)).toBe(true);
    expect(t2 >= t1).toBe(true); // same or later (if refresh happened)
  }, 30_000);
});

describe("getFile", () => {
  it("reads a known file (README.md) from the repository", async () => {
    const res = await getFile({
      owner: OWNER,
      repo: REPO,
      path: "README.md",
    });

    expect(res).toHaveProperty("sha");
    expect(res).toHaveProperty("size");
    expect(res).toHaveProperty("encoding");
    expect(res).toHaveProperty("content");
    expect(res).toHaveProperty("path", "README.md");

    // content is a Buffer with nonzero length (most repos have a README)
    expect(Buffer.isBuffer(res.content)).toBe(true);
    expect((res.content as Buffer).length).toBeGreaterThan(0);
  }, 30_000);
});

describeIf(ALLOW_WRITES)("checkinFile (write tests)", () => {
  const testPath = `tmp/github-test-e2e-${Date.now()}.txt`;
  const message1 = `[test] create ${testPath}`;
  const message2 = `[test] update ${testPath}`;

  it("creates and then updates a file", async () => {
    // Create
    const create = await checkinFile({
      owner: OWNER,
      repo: REPO,
      path: testPath,
      message: message1,
      content: `created at ${new Date().toISOString()}\n`,
    });

    expect(create).toHaveProperty("content.path", testPath);
    expect(create).toHaveProperty("content.sha");
    expect(create).toHaveProperty("commit.sha");

    const createdSha = create.content!.sha!;
    expect(typeof createdSha).toBe("string");

    // Verify read returns same sha
    const read1 = await getFile({ owner: OWNER, repo: REPO, path: testPath });
    expect(read1.sha).toBe(createdSha);

    // Update
    const update = await checkinFile({
      owner: OWNER,
      repo: REPO,
      path: testPath,
      message: message2,
      content: `updated at ${new Date().toISOString()}\n`,
      sha: createdSha,
    });

    expect(update).toHaveProperty("content.path", testPath);
    expect(update).toHaveProperty("content.sha");
    expect(update).toHaveProperty("commit.sha");

    const updatedSha = update.content!.sha!;
    expect(updatedSha).not.toBe(createdSha);

    // Verify read returns new sha
    const read2 = await getFile({ owner: OWNER, repo: REPO, path: testPath });
    expect(read2.sha).toBe(updatedSha);
  }, 60_000);
});
