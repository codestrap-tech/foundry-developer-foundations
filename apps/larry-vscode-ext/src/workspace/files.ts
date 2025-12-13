import * as vscode from 'vscode';

// ============================================================================
// File Operations
// ============================================================================

/**
 * Opens a file in VS Code editor
 * Handles Docker container paths that start with /workspace
 */
export async function openFile(filePath: string): Promise<void> {
  const resolvedPath = resolveWorkspacePath(filePath);
  await vscode.commands.executeCommand(
    'vscode.open',
    vscode.Uri.file(resolvedPath),
  );
}

/**
 * Reads file content
 * Handles Docker container paths that start with /workspace
 */
export async function readFileContent(filePath: string): Promise<string> {
  const resolvedPath = resolveWorkspacePath(filePath);
  const fileContent = await vscode.workspace.fs.readFile(
    vscode.Uri.file(resolvedPath),
  );
  return Buffer.from(fileContent).toString('utf8');
}

/**
 * Resolves a path that might be a Docker container path (/workspace/...)
 * to an actual workspace path
 */
export function resolveWorkspacePath(filePath: string): string {
  let resolvedPath = filePath;

  if (filePath.startsWith('/workspace/')) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      resolvedPath = filePath.replace(
        '/workspace/',
        workspaceFolder.uri.fsPath + '/',
      );
    }
  }

  return resolvedPath;
}

// ============================================================================
// Thread ID File Management
// ============================================================================

/**
 * Reads the current thread IDs for a worktree from the local file
 *
 * @param worktreeName - The name of the worktree
 * @returns Array of thread IDs or undefined if file doesn't exist
 */
export async function readCurrentThreadId(
  worktreeName: string,
): Promise<string[] | undefined> {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }

    const threadIdsFilePath = vscode.Uri.joinPath(
      workspaceFolder.uri,
      '.larry',
      'worktrees',
      worktreeName,
      'tmp',
      'worktreeLocalThreads.json',
    );

    const fileContent = await vscode.workspace.fs.readFile(threadIdsFilePath);
    const threadIds = JSON.parse(fileContent.toString());
    return Array.isArray(threadIds) ? threadIds : [];
  } catch (error) {
    // File doesn't exist or can't be read
    return undefined;
  }
}

/**
 * Writes a thread ID to the worktree's local file
 * Appends to existing thread IDs if any exist
 *
 * @param worktreeName - The name of the worktree
 * @param threadId - The thread ID to write
 */
export async function writeCurrentThreadId(
  worktreeName: string,
  threadId: string,
): Promise<void> {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    const tmpDir = vscode.Uri.joinPath(
      workspaceFolder.uri,
      '.larry',
      'worktrees',
      worktreeName,
      'tmp',
    );

    // Create tmp directory if it doesn't exist
    await vscode.workspace.fs.createDirectory(tmpDir);

    const threadIdsFilePath = vscode.Uri.joinPath(
      tmpDir,
      'worktreeLocalThreads.json',
    );

    // Read existing thread IDs or initialize empty array
    let existingThreadIds: string[] = [];
    try {
      const fileContent = await vscode.workspace.fs.readFile(threadIdsFilePath);
      existingThreadIds = JSON.parse(fileContent.toString());
    } catch (error) {
      // File doesn't exist or can't be parsed, start with empty array
      existingThreadIds = [];
    }

    // Add new thread ID if it doesn't already exist
    if (!existingThreadIds.includes(threadId)) {
      existingThreadIds.push(threadId);
    }

    // Write updated thread IDs back to file
    await vscode.workspace.fs.writeFile(
      threadIdsFilePath,
      Buffer.from(JSON.stringify(existingThreadIds, null, 2), 'utf8'),
    );
  } catch (error) {
    console.error('Error writing thread ID file:', error);
  }
}

// ============================================================================
// Worktree Path Utilities
// ============================================================================

/**
 * Gets the full path to a worktree directory
 */
export function getWorktreePath(worktreeName: string): string | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return undefined;
  }

  return vscode.Uri.joinPath(
    workspaceFolder.uri,
    '.larry',
    'worktrees',
    worktreeName,
  ).fsPath;
}

/**
 * Checks if a worktree path exists
 */
export async function worktreeExists(worktreeName: string): Promise<boolean> {
  const worktreePath = getWorktreePath(worktreeName);
  if (!worktreePath) {
    return false;
  }

  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(worktreePath));
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens a worktree folder in VS Code
 */
export async function openWorktreeFolder(worktreeId: string): Promise<void> {
  let workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const activeFileUri = activeEditor.document.uri;
      workspaceFolder = vscode.workspace.getWorkspaceFolder(activeFileUri);
    }
  }

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  const worktreePath = vscode.Uri.joinPath(
    workspaceFolder.uri,
    '.larry',
    'worktrees',
    worktreeId,
  ).fsPath;

  // Convert relative path to absolute path
  const absoluteWorktreePath = worktreePath.startsWith('.')
    ? vscode.Uri.joinPath(workspaceFolder.uri, worktreePath).fsPath
    : worktreePath;

  // Check if worktree exists
  const exists = await vscode.workspace.fs
    .stat(vscode.Uri.file(absoluteWorktreePath))
    .then(
      () => true,
      () => false,
    );

  if (!exists) {
    const createWorktree = await vscode.window.showWarningMessage(
      `Worktree doesn't exist at: ${worktreePath}`,
      'Create Worktree',
      'Cancel',
    );

    if (createWorktree === 'Create Worktree') {
      vscode.window.showInformationMessage(
        'Please use the "Open worktree" flow in the extension to create worktrees.',
      );
    }
    return;
  }

  await vscode.commands.executeCommand(
    'vscode.openFolder',
    vscode.Uri.file(absoluteWorktreePath),
    true,
  );
}
