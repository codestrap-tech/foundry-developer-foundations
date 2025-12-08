import * as vscode from 'vscode';
import type { ExtensionState } from '../types';
import { handleWebviewMessage } from './message-handlers';
import { notifyWorktreeChange } from '../workspace/worktree';

// ============================================================================
// Webview HTML Generation
// ============================================================================

/**
 * Generates the Content Security Policy for the webview
 *
 * Note: We use broad `http:` and `https:` for connect-src instead of
 * enumerating specific ports. This matches VS Code's own CSP approach
 * and ensures localhost connections work reliably.
 */
export function generateCSP(webview: vscode.Webview, nonce: string): string {
  return [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource} https:`,
    `script-src 'nonce-${nonce}' ${webview.cspSource}`,
    // Allow http: and https: for API connections (matches VS Code's approach)
    `connect-src ${webview.cspSource} http: https: ws:`,
  ].join('; ');
}

/**
 * Generates the HTML content for the webview
 */
function generateWebviewHTML(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
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
  const csp = generateCSP(webview, nonce);

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
        context.extensionUri
      );

      // Set up message handler
      view.webview.onDidReceiveMessage(async (msg) => {
        await handleWebviewMessage(state, msg, view);
      });

      // Initialize worktree detection after short delay
      console.log(
        '🚀 Starting initial config loading and worktree detection...'
      );
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
export async function notifyWorktreeChangeFromProvider(
  state: ExtensionState
): Promise<void> {
  try {
    await notifyWorktreeChange(state);
  } catch (error) {
    console.error('❌ Error in worktree change handler:', error);
  }
}
p