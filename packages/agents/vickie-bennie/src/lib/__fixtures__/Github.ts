export const mockGithubGetFileResult = {
  sha: 'mock-sha-123',
  size: 42,
  encoding: 'base64',
  content: Buffer.from('mock file content', 'utf8'),
  path: 'path/to/mock-file.txt',
};

export const mockGithubCheckinFileResult = {
  content: {
    path: 'path/to/mock-file.txt',
    sha: 'new-mock-sha-456',
    size: 43,
    url: 'https://api.github.com/repos/owner/repo/contents/path/to/mock-file.txt',
  },
  commit: {
    sha: 'commit-mock-sha-789',
    url: 'https://api.github.com/repos/owner/repo/commits/commit-mock-sha-789',
  },
};