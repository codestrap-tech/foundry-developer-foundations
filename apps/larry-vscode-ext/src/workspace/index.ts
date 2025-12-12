// Workspace Layer Exports

// Git operations
export {
  getCurrentBranchName,
  isInWorktree,
  getCurrentWorktreeId,
  listLocalWorktrees,
  createWorktree,
  removeWorktree,
  transformSessionNameToBranchName,
} from './git';

// File operations
export {
  openFile,
  readFileContent,
  resolveWorkspacePath,
  readCurrentThreadId,
  writeCurrentThreadId,
  getWorktreePath,
  worktreeExists,
  openWorktreeFolder,
} from './files';

// Worktree flow operations
export {
  setupWorktreeEnvironment,
  createOrEnsureWorktree,
  handleOpenWorktree,
  notifyWorktreeChange,
} from './worktree';
