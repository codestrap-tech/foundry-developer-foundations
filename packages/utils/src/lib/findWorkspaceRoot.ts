export function findWorkspaceRoot(): string {
  const workspaceRoot = process.env.WORKSPACE_ROOT;
  if (workspaceRoot) {
    return workspaceRoot;
  }
  throw new Error('Could not find workspace root');
}
