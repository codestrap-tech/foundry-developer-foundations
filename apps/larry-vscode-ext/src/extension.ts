/**
 * Larry VS Code Extension - Entry Point
 * 
 * This is the minimal entry point that bootstraps the extension.
 * All functionality is delegated to layered modules.
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                        extension.ts                             │
 * │                    (Entry Point / Bootstrap)                    │
 * └─────────────────────────────────────────────────────────────────┘
 *                              │
 *                              ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    webview/webview-provider.ts                  │
 * │              (Webview initialization & message routing)         │
 * └─────────────────────────────────────────────────────────────────┘
 *                              │
 *                              ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                  webview/message-handlers.ts                    │
 * │                (Individual message handlers)                    │
 * └─────────────────────────────────────────────────────────────────┘
 *                              │
 *         ┌────────────────────┼────────────────────┐
 *         ▼                    ▼                    ▼
 * ┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐
 * │    docker/    │  │   workspace/    │  │      sse/       │
 * │   server-     │  │   worktree.ts   │  │   sse-proxy.ts  │
 * │ management.ts │  │   files.ts      │  │  sse-streams.ts │
 * │               │  │   git.ts        │  │                 │
 * └───────────────┘  └─────────────────┘  └─────────────────┘
 *         │                    │                    │
 *         └────────────────────┼────────────────────┘
 *                              ▼
 *                    ┌─────────────────┐
 *                    │  config/        │
 *                    │ larry-config.ts │
 *                    └─────────────────┘
 *                              │
 *                              ▼
 *                    ┌─────────────────┐
 *                    │    types/       │
 *                    │   index.ts      │
 *                    └─────────────────┘
 * 
 * Flow on Extension Load:
 * 1. activate() is called by VS Code
 * 2. Load larry.config.json → Initialize state
 * 3. Register webview provider
 * 4. Register workspace change watcher
 * 
 * Flow when Webview Opens:
 * 1. resolveWebviewView() is called
 * 2. Generate HTML with CSP
 * 3. Setup message handlers
 * 4. Detect worktree state
 * 5. Start appropriate Docker container
 * 6. Start SSE connection
 * 
 * Flow on Workspace Change:
 * 1. Workspace change event fires
 * 2. notifyWorktreeChange() is called
 * 3. Detect new worktree state
 * 4. Start/stop Docker containers as needed
 * 5. Update SSE connections
 * 6. Notify webview
 */

import * as vscode from 'vscode';
import { createExtensionState, type ExtensionState } from './types';
import { loadLarryConfig } from './config/larry-config';
import { createWebviewProvider, notifyWorktreeChangeFromProvider } from './webview/webview-provider';
import { stopAllSSEConnections } from './sse/sse-streams';
import { getMainContainerName } from './config/larry-config';
import { ArtifactEditorProvider } from './editors/artifact-editor-provider';
import { exec } from 'child_process';

// ============================================================================
// Extension State
// ============================================================================

let extensionState: ExtensionState;

// ============================================================================
// Activation
// ============================================================================

/**
 * Extension activation entry point
 * Called when the extension is activated by VS Code
 */
export function activate(context: vscode.ExtensionContext): void {
  try {
    console.log('🚀 Larry Extension activation started...');

    // Initialize extension state
    extensionState = createExtensionState();

    // Load configuration (async, but we don't wait)
    extensionState.configLoaded = loadLarryConfig()
      .then((config) => {
        extensionState.config = config;
        console.log('✅ Larry config loaded:', config.name);
      })
      .catch((error) => {
        vscode.window.showErrorMessage(
          `Larry Extension: ${error.message}. Please create a larry.config.json file in your project root.`
        );
        throw error;
      });


    // Register webview provider for sidebar
    const provider = createWebviewProvider(context, extensionState);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider('larryHome', provider, {
        webviewOptions: { retainContextWhenHidden: true },
      })
    );

    // Register custom editor for .larry/artifact files
    context.subscriptions.push(
      vscode.window.registerCustomEditorProvider(
        ArtifactEditorProvider.viewType,
        new ArtifactEditorProvider(context, extensionState),
        {
          webviewOptions: { retainContextWhenHidden: true },
          supportsMultipleEditorsPerDocument: false,
        }
      )
    );

    // Watch for workspace changes to detect worktree changes
    const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      notifyWorktreeChangeFromProvider(extensionState);
    });
    context.subscriptions.push(workspaceWatcher);

    console.log('🚀 Larry Extension activated successfully!');
    console.log(
      '📁 Workspace folders:',
      vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath)
    );

    // Show activation notification
    vscode.window
      .showInformationMessage('Larry Coding Assistant is now active!')
      .then(
        () => console.log('✅ Activation notification shown'),
        (error) => console.error('❌ Failed to show notification:', error)
      );

  } catch (error) {
    console.error('❌ Critical error during extension activation:', error);
    vscode.window.showErrorMessage(
      `Larry Extension failed to activate: ${error}`
    );
  }
}

// ============================================================================
// Deactivation
// ============================================================================

/**
 * Extension deactivation handler
 * Called when the extension is deactivated
 */
export function deactivate(): void {
  try {
    console.log('🔄 Larry Extension deactivating...');

    // Stop all SSE connections
    if (extensionState) {
      stopAllSSEConnections(extensionState);
    }

    // Cleanup main docker container if running
    const containerName = getMainContainerName(extensionState?.config?.name);
    exec(`docker rm -f ${containerName}`, () => {
      // Ignore errors during cleanup
    });

    console.log('✅ Larry Extension deactivated');
  } catch (error) {
    // Ignore cleanup errors
    console.error('Error during deactivation:', error);
  }
}

