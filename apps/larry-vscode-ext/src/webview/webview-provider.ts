import * as vscode from 'vscode';
import type { ExtensionState } from '../types';
import { DEFAULT_MAIN_PORT, DEFAULT_WORKTREE_PORT, PORT_RANGE } from '../types';
import { handleWebviewMessage } from './message-handlers';
import { notifyWorktreeChange } from '../workspace/worktree';

// ============================================================================
// Webview HTML Generation
// ============================================================================

/**
 * Generates the Content Security Policy for the webview
 */
function generateCSP(
  webview: vscode.Webview,
  nonce: string,
  mainPort: number,
  worktreePort: number
): string {
  const worktreePorts = Array.from({ length: PORT_RANGE }, (_, i) =>
    `http://localhost:${worktreePort + i}`
  ).join(' ');
  const mainPorts = Array.from({ length: PORT_RANGE }, (_, i) =>
    `http://localhost:${mainPort + i}`
  ).join(' ');

  return [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource} https:`,
    `script-src 'nonce-${nonce}' ${webview.cspSource}`,
    `connect-src 'self' ${webview.cspSource} ${worktreePorts} ${mainPorts}`,
  ].join('; ');
}

/**
 * Generates the HTML content for the webview
 */
function generateWebviewHTML(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  mainPort: number,
  worktreePort: number
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'webview.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'webview.css')
  );
  const overridesUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'overrides.css')
  );
  
  const nonce = String(Date.now());
  const csp = generateCSP(webview, nonce, mainPort, worktreePort);

  return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="${styleUri}">
  <link rel="stylesheet" href="${overridesUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

// ============================================================================
// Webview Provider
// ============================================================================

/**
 * Creates a WebviewViewProvider for the Larry extension
 * 
 * @param context - VS Code extension context
 * @param state - Shared extension state
 * @returns WebviewViewProvider instance
 */
export function createWebviewProvider(
  context: vscode.ExtensionContext,
  state: ExtensionState
): vscode.WebviewViewProvider {
  return {
    resolveWebviewView(view: vscode.WebviewView) {
      console.log('🎯 Larry webview opened by user - initializing...');
      
      // Store view reference in state
      state.view = view;
      
      // Configure webview options
      view.webview.options = {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
        ],
      };

      // Set webview HTML content
      view.webview.html = generateWebviewHTML(
        view.webview,
        context.extensionUri,
        state.mainPort || DEFAULT_MAIN_PORT,
        state.worktreePort || DEFAULT_WORKTREE_PORT
      );

      // Set up message handler
      view.webview.onDidReceiveMessage(async (msg) => {
        await handleWebviewMessage(state, msg, view);
      });

      // Initialize worktree detection after short delay
      console.log('🚀 Starting initial config loading and worktree detection...');
      setTimeout(async () => {
        try {
          await notifyWorktreeChange(state);
        } catch (error) {
          console.error('❌ Failed to initialize extension:', error);
        }
      }, 100);
    },
  };
}

/**
 * Notifies the webview about worktree changes
 * Call this when workspace folders change
 */
export async function notifyWorktreeChangeFromProvider(state: ExtensionState): Promise<void> {
  try {
    await notifyWorktreeChange(state);
  } catch (error) {
    console.error('❌ Error in worktree change handler:', error);
  }
}

