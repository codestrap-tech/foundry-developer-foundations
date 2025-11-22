import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { WorktreeInfo } from '../types';

const execAsync = promisify(exec);

// ============================================================================
// Git Branch Operations
// ============================================================================

/**
 * Gets the current branch name for a repository
 */
export async function getCurrentBranchName(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoPath,
    });

    const branchName = stdout.trim();
    console.log('Current branch:', branchName);
    return branchName || 'unknown';
  } catch (error) {
    console.error('Error getting current branch:', error);
    return 'unknown';
  }
}

// ============================================================================
// Worktree Detection
// ============================================================================

/**
 * Checks if the current workspace is inside a git worktree
 */
export async function isInWorktree(): Promise<boolean> {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return false;
    }

    const gitPath = vscode.Uri.joinPath(workspaceFolder.uri, '.git');

    try {
      const gitStat = await vscode.workspace.fs.stat(gitPath);

      if (gitStat.type === vscode.FileType.File) {
        const gitContent = await vscode.workspace.fs.readFile(gitPath);
        const gitDir = gitContent.toString().trim();

        // If .git is a file pointing to a worktree, we're in a worktree
        return gitDir.includes('worktrees/');
      } else {
        // If .git is a directory, we're in the main repository
        return false;
      }
    } catch (gitError) {
      // If .git doesn't exist or can't be read, assume not in worktree
      return false;
    }
  } catch (error) {
    console.error('Error detecting worktree:', error);
    return false;
  }
}

/**
 * Gets the current worktree ID (name) from the workspace
 * Returns empty string if not in a worktree or unable to detect
 */
export async function getCurrentWorktreeId(): Promise<string> {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      console.log('No workspace folder found');
      return '';
    }

    console.log('Checking worktree for workspace:', workspaceFolder.uri.fsPath);

    const gitPath = vscode.Uri.joinPath(workspaceFolder.uri, '.git');

    try {
      const gitStat = await vscode.workspace.fs.stat(gitPath);

      if (gitStat.type === vscode.FileType.File) {
        const gitContent = await vscode.workspace.fs.readFile(gitPath);
        const gitDir = gitContent.toString().trim();
        console.log('Git dir content:', gitDir);

        const worktreeMatch = gitDir.match(/worktrees\/([^/]+)/);
        if (worktreeMatch) {
          return worktreeMatch[1]; // Return the actual worktree name
        } else {
          const worktreeName = gitDir.split('/').pop() || 'unknown';
          return worktreeName;
        }
      } else {
        return await getCurrentBranchName(workspaceFolder.uri.fsPath);
      }
    } catch (gitError) {
      // If .git is a directory, we're in the main repository, get current branch
      return await getCurrentBranchName(workspaceFolder.uri.fsPath);
    }
  } catch (error) {
    console.error('Error detecting worktree:', error);
    return '';
  }
}

// ============================================================================
// Worktree Listing
// ============================================================================

/**
 * Lists all local worktrees in the .larry/worktrees directory
 */
export async function listLocalWorktrees(): Promise<WorktreeInfo[]> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return [];
  }

  try {
    const { stdout } = await execAsync('git worktree list --porcelain', {
      cwd: workspaceFolder.uri.fsPath,
    });

    /* Parse worktree blocks separated by blank lines
    example out of git worktree list --porcelain:
    worktree /Users/przemek/Projects/foundry-developer-foundations
    HEAD eb907726f9838ed37501d33b6973b9646d4603e1
    branch refs/heads/pn/parametrize-larry-extension

    worktree /Users/przemek/Projects/foundry-developer-foundations/.larry/worktrees/create-sending-email-function-gsf
    HEAD 234786afcd4c40f6a47a78b7796062891cc591be
    branch refs/heads/larry/create-sending-email-function-gsf
    */
    const worktreeBlocks = stdout.split('\n\n').filter((block) => block.trim());
    
    const worktrees = worktreeBlocks
      .map((block) => {
        const lines = block.split('\n');
        const worktreeLine = lines.find((l) => l.startsWith('worktree '));
        const branchLine = lines.find((l) => l.startsWith('branch '));

        if (!worktreeLine) return null;

        const path = worktreeLine.replace('worktree ', '').trim();
        
        let branch = 'detached';
        if (branchLine) {
          const branchRef = branchLine.replace('branch ', '').trim();
          branch = branchRef.replace('refs/heads/', '');
        }
        const pathMatch = path.match(/\.larry[/\\]worktrees[/\\]([^/\\]+)$/);
        if (!pathMatch) return null;

        const worktreeName = pathMatch[1];

        return {
          worktreeName,
          branch,
          path,
        };
      })
      .filter((item): item is WorktreeInfo => item !== null);

    return worktrees;
  } catch (error) {
    console.error('Error listing local worktrees:', error);
    return [];
  }
}

// ============================================================================
// Worktree CRUD Operations
// ============================================================================

/**
 * Creates a new git worktree
 * 
 * @param workspaceFolder - The main workspace folder
 * @param worktreeName - Name for the new worktree
 * @returns The created worktree path
 */
export async function createWorktree(
  workspaceFolder: vscode.WorkspaceFolder,
  worktreeName: string
): Promise<string> {
  const worktreePath = vscode.Uri.joinPath(
    workspaceFolder.uri,
    '.larry',
    'worktrees',
    worktreeName
  );

  // Create the .larry/worktrees directory if it doesn't exist
  await vscode.workspace.fs.createDirectory(
    vscode.Uri.joinPath(workspaceFolder.uri, '.larry', 'worktrees')
  );

  // Create branch name in larry/ format
  const branchName = `larry/${worktreeName}`;

  try {
    // Get current branch name to branch from
    const { stdout: currentBranch } = await execAsync(
      'git rev-parse --abbrev-ref HEAD',
      { cwd: workspaceFolder.uri.fsPath }
    );
    const sourceBranch = currentBranch.trim();

    console.log(`Creating worktree from current branch: ${sourceBranch}`);

    await execAsync(
      `git worktree add "${worktreePath.fsPath}" -b ${branchName} ${sourceBranch}`,
      { cwd: workspaceFolder.uri.fsPath }
    );
  } catch (branchError: unknown) {
    const errorMessage = branchError instanceof Error ? branchError.message : String(branchError);
    
    // If branch already exists, try to use existing branch
    if (errorMessage.includes('already exists')) {
      console.log(`Branch ${branchName} already exists, trying to use existing branch`);
      try {
        await execAsync(
          `git worktree add "${worktreePath.fsPath}" ${branchName}`,
          { cwd: workspaceFolder.uri.fsPath }
        );
      } catch (existingBranchError: unknown) {
        const existingErrorMessage = existingBranchError instanceof Error 
          ? existingBranchError.message 
          : String(existingBranchError);
          
        if (existingErrorMessage.includes('already checked out')) {
          throw new Error(`Worktree path already exists: ${worktreePath.fsPath}`);
        } else {
          throw existingBranchError;
        }
      }
    } else {
      throw branchError;
    }
  }

  return worktreePath.fsPath;
}

/**
 * Removes a git worktree
 */
export async function removeWorktree(worktreeName: string): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder found');
  }

  const worktreePath = vscode.Uri.joinPath(
    workspaceFolder.uri,
    '.larry',
    'worktrees',
    worktreeName
  ).fsPath;

  await execAsync(`git worktree remove "${worktreePath}" --force`, {
    cwd: workspaceFolder.uri.fsPath,
  });

  // Try to delete any remaining files
  try {
    await vscode.workspace.fs.delete(vscode.Uri.file(worktreePath), {
      recursive: true,
    });
  } catch (e) {
    // Directory might already be removed
  }

  // Prune worktree references
  await execAsync('git worktree prune', {
    cwd: workspaceFolder.uri.fsPath,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Transforms a session name into a valid git branch name
 */
export function transformSessionNameToBranchName(sessionName: string): string {
  return sessionName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50); // Limit length
}

