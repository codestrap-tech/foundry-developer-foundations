import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import type { ExtensionState, LarryConfig } from '../types';
import {
  createWorktree as gitCreateWorktree,
  transformSessionNameToBranchName,
} from './git';
import {
  writeCurrentThreadId,
  readCurrentThreadId,
  getWorktreePath,
  openWorktreeFolder,
} from './files';
import {
  startWorktreeDockerContainer,
  getWorktreeContainerStatus,
  startExistingContainer,
  ensureMainDockerRunning,
} from '../docker/server-management';
import { startWorktreeSSE, startMainSSE } from '../sse/sse-streams';
import { getCurrentWorktreeId, isInWorktree } from './git';

const execAsync = promisify(exec);

/**
 * Builds a comprehensive PATH that includes common locations for Node.js tools.
 * This is necessary because VSCode launched from Dock/Spotlight has a minimal PATH.
 */
function buildExtendedPath(homeDir: string): string {
  const existingPath = process.env.PATH || '/usr/bin:/bin';

  // Common locations where pnpm, npm, node might be installed
  const additionalPaths = [
    // Homebrew (Apple Silicon)
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    // Homebrew (Intel)
    '/usr/local/bin',
    '/usr/local/sbin',
    // pnpm standalone installer
    `${homeDir}/.local/share/pnpm`,
    `${homeDir}/Library/pnpm`,
    // npm global
    `${homeDir}/.npm-global/bin`,
    `${homeDir}/.npm/bin`,
    // nvm - common versions (we add a few recent LTS versions)
    `${homeDir}/.nvm/versions/node/v22.0.0/bin`,
    `${homeDir}/.nvm/versions/node/v20.0.0/bin`,
    `${homeDir}/.nvm/versions/node/v18.0.0/bin`,
    // fnm (Fast Node Manager)
    `${homeDir}/.fnm/aliases/default/bin`,
    `${homeDir}/Library/Application Support/fnm/aliases/default/bin`,
    // volta
    `${homeDir}/.volta/bin`,
    // asdf
    `${homeDir}/.asdf/shims`,
    // n (node version manager)
    '/usr/local/n/versions/node/*/bin',
    `${homeDir}/n/bin`,
    // Corepack / yarn / pnpm via corepack
    `${homeDir}/.corepack/bin`,
    // Standard paths
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ];

  // Combine paths, putting additional paths first so they take precedence
  const allPaths = [...additionalPaths, ...existingPath.split(':')];

  // Remove duplicates while preserving order
  const uniquePaths = [...new Set(allPaths)];

  return uniquePaths.join(':');
}

/**
 * Executes a command in the user's login shell environment.
 * This ensures that shell profile (.zshrc, .bashrc) is loaded,
 * which is necessary for tools like nvm, node-gyp, pnpm, etc.
 *
 * Works reliably even when VSCode is launched from Dock/Spotlight
 * where the environment is minimal.
 */
async function execInUserShell(
  command: string,
  options: { cwd?: string } = {}
): Promise<{ stdout: string; stderr: string }> {
  // Use os.homedir() which is reliable even without env vars
  const homeDir = os.homedir();

  // Determine the user's shell - fallback chain for robustness
  const userShell = process.env.SHELL || '/bin/zsh';

  // Build extended PATH for when profile loading fails
  const extendedPath = buildExtendedPath(homeDir);

  // Use -l for login shell (loads profile), -i for interactive (loads rc files), -c to execute command
  // The -i flag helps with some shells that only load certain configs in interactive mode
  const shellCommand = `${userShell} -l -i -c ${JSON.stringify(command)}`;

  return execAsync(shellCommand, {
    ...options,
    env: {
      ...process.env,
      // Ensure HOME is set - critical for profile loading
      HOME: homeDir,
      // Provide extended PATH as fallback when profile doesn't load correctly
      PATH: extendedPath,
      // Some tools need these
      USER: process.env.USER || os.userInfo().username,
      SHELL: userShell,
      // Disable interactive prompts that might hang
      CI: 'true',
      // Don't override PNPM_HOME if already set - location varies by install method
      // Common locations: ~/Library/pnpm (Homebrew) or ~/.local/share/pnpm (standalone)
      ...(process.env.PNPM_HOME
        ? {}
        : { PNPM_HOME: `${homeDir}/Library/pnpm` }),
    },
  });
}

// ============================================================================
// Worktree Environment Setup
// ============================================================================

/**
 * Sets up the worktree environment (copies env files, runs setup commands)
 */
export async function setupWorktreeEnvironment(
  config: LarryConfig,
  worktreeName: string,
  onStateUpdate: (state: string) => void
): Promise<void> {
  try {
    onStateUpdate('setting_up_environment');

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

    // Copy env file if configured
    if (config.larryEnvPath) {
      console.log(`Copying env file from ${config.larryEnvPath}...`);
      const sourceEnvPath = vscode.Uri.joinPath(
        workspaceFolder.uri,
        config.larryEnvPath
      ).fsPath;
      const targetEnvPath = path.join(worktreePath, config.larryEnvPath);

      await execAsync(`cp ${sourceEnvPath} ${targetEnvPath}`);
    }

    // Run workspace setup commands sequentially
    for (const command of config.workspaceSetupCommand) {
      console.log(`Running workspace setup command: ${command}`);
      await execInUserShell(command, { cwd: worktreePath });
    }

    console.log('Worktree environment setup completed');
  } catch (error) {
    console.error('Error setting up worktree environment:', error);
    throw error;
  }
}

// ============================================================================
// Worktree Creation & Management Flow
// ============================================================================

/**
 * Creates or ensures a worktree exists
 * Returns the final worktree name
 */
export async function createOrEnsureWorktree(
  worktreeName: string,
  threadId: string | undefined,
  label: string,
  onStateUpdate: (state: string) => void
): Promise<string> {
  try {
    let workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        workspaceFolder = vscode.workspace.getWorkspaceFolder(
          activeEditor.document.uri
        );
      }
    }

    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    // Generate final worktree name if not provided
    let finalWorktreeName = worktreeName;
    if (!finalWorktreeName || finalWorktreeName.trim() === '') {
      finalWorktreeName =
        transformSessionNameToBranchName(label) +
        '-' +
        Math.random().toString(36).substring(2, 5);
    }

    // Check if worktree already exists
    const worktreePath = vscode.Uri.joinPath(
      workspaceFolder.uri,
      '.larry',
      'worktrees',
      finalWorktreeName
    );

    const worktreeExists = await vscode.workspace.fs.stat(worktreePath).then(
      () => true,
      () => false
    );

    if (!worktreeExists) {
      onStateUpdate('creating_worktree');

      // Create worktree
      await gitCreateWorktree(workspaceFolder, finalWorktreeName);

      // Write thread ID to file only if provided (existing worktree case)
      if (threadId && threadId.trim() !== '') {
        try {
          await writeCurrentThreadId(finalWorktreeName, threadId);
          console.log(
            `Worktree created: ${finalWorktreeName} with thread ID: ${threadId}`
          );
        } catch (error) {
          console.error('Failed to write thread ID file:', error);
        }
      } else {
        console.log(
          `New worktree created: ${finalWorktreeName} - thread ID will be assigned later`
        );
      }
    }

    return finalWorktreeName;
  } catch (error) {
    console.error('Error creating or ensuring worktree:', error);
    throw error;
  }
}

// ============================================================================
// Open Worktree Flow
// ============================================================================

/**
 * Handles the complete flow of opening a worktree:
 * 1. Create or ensure worktree exists
 * 2. Setup environment if needed
 * 3. Start Docker container
 * 4. Start SSE connection
 * 5. Open the worktree folder
 */
export async function handleOpenWorktree(
  state: ExtensionState,
  worktreeName: string,
  threadId: string | undefined,
  label: string,
  agentKey?: string
): Promise<void> {
  const postMessage = (msg: Record<string, unknown>) => {
    state.view?.webview.postMessage(msg);
  };

  const onStateUpdate = (stateValue: string) => {
    postMessage({ type: 'update_thread_state', state: stateValue });
  };

  try {
    if (!state.config) {
      throw new Error('Config not loaded');
    }

    // Step 1: Create or ensure worktree exists
    const finalWorktreeName = await createOrEnsureWorktree(
      worktreeName,
      threadId,
      label,
      onStateUpdate
    );

    if (!finalWorktreeName) {
      throw new Error('Failed to create or find worktree');
    }

    // Step 2: Check if container is already running
    const containerStatus = await getWorktreeContainerStatus(
      state.config.name,
      finalWorktreeName
    );

    if (!containerStatus.isRunning) {
      // Step 3: Setup worktree environment
      await setupWorktreeEnvironment(
        state.config,
        finalWorktreeName,
        onStateUpdate
      );

      // Step 4: Start Docker container
      onStateUpdate('creating_container');

      if (threadId) {
        await writeCurrentThreadId(finalWorktreeName, threadId);
      }

      const worktreePath = getWorktreePath(finalWorktreeName);
      if (!worktreePath) {
        throw new Error('Could not determine worktree path');
      }

      await startWorktreeDockerContainer(
        state,
        finalWorktreeName,
        worktreePath,
        threadId
      );
    }

    // Step 5: Notify that worktree is ready
    postMessage({
      type: 'worktree_ready',
      worktreeName: finalWorktreeName,
      threadId,
    });

    // Step 6: Start SSE and open folder (with delay for container startup)
    setTimeout(() => {
      if (state.config) {
        startWorktreeSSE(state, state.config, agentKey);
      }
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      openWorktreeFolder(finalWorktreeName);
      postMessage({ type: 'update_thread_state', state: 'ready' });
    }, 3000);
  } catch (error) {
    console.error('Error handling open worktree:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    vscode.window.showErrorMessage(`Failed to setup worktree: ${errorMessage}`);

    postMessage({
      type: 'worktree_setup_error',
      error: errorMessage,
      worktreeName,
      threadId,
    });
  }
}

// ============================================================================
// Worktree Detection & Notification
// ============================================================================

/**
 * Detects the current worktree state and notifies the webview
 * Also ensures appropriate Docker container is running
 */
export async function notifyWorktreeChange(
  state: ExtensionState
): Promise<void> {
  if (!state.view || !state.config) return;

  const worktreeId = await getCurrentWorktreeId();
  const inWorktree = await isInWorktree();
  let currentThreadId: string | undefined;

  // If in worktree, try to read thread ID from file and check container status
  if (inWorktree && worktreeId) {
    try {
      const threadIds = await readCurrentThreadId(worktreeId);
      currentThreadId =
        threadIds && threadIds.length > 0
          ? threadIds[threadIds.length - 1]
          : undefined;
    } catch (error) {
      console.error('Error reading thread ID for worktree:', error);
    }

    // Check container status and start if needed
    const containerStatus = await getWorktreeContainerStatus(
      state.config.name,
      worktreeId
    );

    if (containerStatus.containerId) {
      state.worktreePort = containerStatus.port;

      if (!containerStatus.isRunning) {
        await startExistingContainer(containerStatus.containerId);
      }
      state.runningContainers.set(worktreeId, containerStatus.containerId);
    } else {
      // Container doesn't exist, need to create it
      const worktreePath = getWorktreePath(worktreeId);
      if (worktreePath) {
        await startWorktreeDockerContainer(
          state,
          worktreeId,
          worktreePath,
          undefined
        );
      }
    }
  }

  // Send detection message to webview
  const message = {
    type: 'worktree_detection',
    isInWorktree: inWorktree,
    currentThreadId: currentThreadId || undefined,
    worktreeName: worktreeId,
    worktreePort: state.worktreePort,
    mainPort: state.mainPort,
  };

  console.log('📤 Sending message to webview:', message);
  state.view.webview.postMessage(message);
  console.log('📤 Message sent successfully');

  // Start appropriate SSE based on worktree state
  if (!inWorktree) {
    console.log(
      '🐳 User is not in worktree - starting main Docker container...'
    );
    await ensureMainDockerRunning(state);
    startMainSSE(state);
  } else {
    console.log('🌿 User is in worktree - starting worktree SSE');
    startWorktreeSSE(state, state.config);
  }
}
