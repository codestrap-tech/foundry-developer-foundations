import * as vscode from 'vscode';
import * as path from 'path';
import type { ExtensionState } from '../types';
import { DEFAULT_MAIN_PORT, DEFAULT_WORKTREE_PORT } from '../types';
import { generateCSP } from '../webview/webview-provider';

/**
 * Custom editor provider for Larry artifact files (.larry/artifact/**)
 * 
 * Renders markdown/code files with MDXEditor in a Preact webview
 * and integrates with the Larry state machine workflow.
 * 
 * This editor receives state from the sidebar webview via extension relay:
 * - LarryState (threadId, apiUrl, machineData, etc.)
 * - React Query cache (dehydrated for hydration)
 * 
 * See webview/src/store/docs.md for architecture details.
 */
export class ArtifactEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'larry.artifactEditor';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionState: ExtensionState
  ) {}

  /**
   * Called when VS Code opens a file matching our selector
   */
  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Register this panel for state broadcasts
    this.extensionState.artifactEditorPanels.add(webviewPanel);

    // Setup webview options
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ],
    };

    // Initial render with bundled editor webview
    webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview,
      this.context.extensionUri
    );

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage((message) => {
      this.handleMessage(message, document, webviewPanel);
    });

    // Clean up when panel is closed
    webviewPanel.onDidDispose(() => {
      this.extensionState.artifactEditorPanels.delete(webviewPanel);
    });
  }

  /**
   * Sends initial content to webview with cached LarryState and query cache
   */
  private sendInitialContent(
    webview: vscode.Webview,
    document: vscode.TextDocument
  ): void {
    const fileName = path.basename(document.fileName);

    webview.postMessage({
      type: 'initialContent',
      content: document.getText(),
      fileName,
      filePath: document.fileName,
      // Send cached state from sidebar
      larryState: this.extensionState.larryState,
      queryCache: this.extensionState.queryCache,
    });
  }

  /**
   * Handles messages from the webview
   */
  private async handleMessage(
    message: { type: string; content?: string; [key: string]: unknown },
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    switch (message.type) {
      case 'getEditorContent':
        // Send initial content with cached state
        this.sendInitialContent(panel.webview, document);
        break;

      case 'edit':
        // Apply edit to the document - replace entire file content and save to disk
        if (message.content !== undefined) {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            message.content as string
          );
          await vscode.workspace.applyEdit(edit);
          // Save the document to disk so the server can read the updated content
        await document.save();
        }
        break;

      case 'readFile':
        // Read file from workspace and send content back
        const filePath = message.filePath as string;
        try {
          const fileUri = vscode.Uri.file(filePath);
          const fileContent = await vscode.workspace.fs.readFile(fileUri);
          panel.webview.postMessage({
            type: 'fileContent',
            filePath,
            content: new TextDecoder().decode(fileContent),
          });
        } catch (error) {
          console.error('Failed to read file:', error);
          panel.webview.postMessage({
            type: 'fileReadError',
            filePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        break;

      case 'set_larry_working':
        // Relay working state to sidebar so it shows working indicator
        this.extensionState.view?.webview.postMessage({
          type: 'set_larry_working',
          isWorking: message.isWorking,
        });
        break;
    }
  }

  /**
   * Generates the HTML content for the webview using bundled editor
   */
  private getHtmlForWebview(
    webview: vscode.Webview,
    extensionUri: vscode.Uri
  ): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'editor-webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'webview.css')
    );
    const overridesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'overrides.css')
    );

    const nonce = String(Date.now());
    const csp = generateCSP(
      webview,
      nonce,
      this.extensionState.mainPort || DEFAULT_MAIN_PORT,
      this.extensionState.worktreePort || DEFAULT_WORKTREE_PORT
    );

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
}
