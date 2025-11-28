import * as vscode from 'vscode';
import * as path from 'path';
import type { ExtensionState } from '../types';

/**
 * Custom editor provider for Larry artifact files (.larry/artifact/**)
 * 
 * Renders markdown/code files with approve/reject buttons and
 * integrates with the Larry state machine workflow.
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
    // Setup webview options
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ],
    };

    // Initial render
    webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview,
      document
    );

    // Listen for document changes (external edits, saves)
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          this.updateWebview(webviewPanel.webview, document);
        }
      }
    );

    // Clean up when panel is closed
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage((message) => {
      this.handleMessage(message, document, webviewPanel);
    });
  }

  /**
   * Updates the webview content when document changes
   */
  private updateWebview(
    webview: vscode.Webview,
    document: vscode.TextDocument
  ): void {
    webview.postMessage({
      type: 'update',
      content: document.getText(),
      fileName: path.basename(document.fileName),
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
      case 'edit':
        // Apply edit to the document
        if (message.content !== undefined) {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            message.content
          );
          await vscode.workspace.applyEdit(edit);
        }
        break;

      case 'save':
        await document.save();
        vscode.window.showInformationMessage('File saved!');
        break;

      case 'openInDefaultEditor':
        // Close custom editor and open in default text editor
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        await vscode.commands.executeCommand(
          'vscode.openWith',
          document.uri,
          'default'
        );
        break;

      case 'copyToClipboard':
        if (message.content) {
          await vscode.env.clipboard.writeText(message.content);
          vscode.window.showInformationMessage('Copied to clipboard!');
        }
        break;

      // ================================================================
      // Extension State Actions (shared with sidebar)
      // ================================================================

      case 'getConfig':
        // Send config to webview (same as sidebar)
        panel.webview.postMessage({
          type: 'config_loaded',
          config: this.extensionState.config,
          worktreePort: this.extensionState.worktreePort,
          mainPort: this.extensionState.mainPort,
        });
        break;

      case 'approve':
        // Handle approve action - you can customize this
        await document.save();
        vscode.window.showInformationMessage('✅ Artifact approved!');
        // Optionally notify the sidebar
        this.extensionState.view?.webview.postMessage({
          type: 'artifact_approved',
          filePath: document.uri.fsPath,
        });
        break;

      case 'reject':
        // Handle reject action with feedback
        const feedback = message.feedback as string;
        vscode.window.showInformationMessage(`❌ Artifact rejected: ${feedback || 'No feedback'}`);
        // Optionally notify the sidebar
        this.extensionState.view?.webview.postMessage({
          type: 'artifact_rejected',
          filePath: document.uri.fsPath,
          feedback,
        });
        break;

      case 'notifySidebar':
        // Send arbitrary message to sidebar webview
        this.extensionState.view?.webview.postMessage(message.payload);
        break;
    }
  }

  /**
   * Generates the HTML content for the webview
   */
  private getHtmlForWebview(
    webview: vscode.Webview,
    document: vscode.TextDocument
  ): string {
    const content = document.getText();
    const fileName = path.basename(document.fileName);
    const fileExt = path.extname(document.fileName).slice(1);
    
    // Determine file type for syntax highlighting
    const languageMap: Record<string, string> = {
      md: 'markdown',
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      py: 'python',
      css: 'css',
      html: 'html',
    };
    const language = languageMap[fileExt] || 'plaintext';

    // Get nonce for CSP
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <title>${fileName}</title>
  <style>
    :root {
      --bg-color: var(--vscode-editor-background);
      --fg-color: var(--vscode-editor-foreground);
      --border-color: var(--vscode-panel-border);
      --button-bg: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
      --button-hover: var(--vscode-button-hoverBackground);
      --success-color: #28a745;
      --warning-color: #ffc107;
      --info-bg: var(--vscode-textBlockQuote-background);
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--fg-color);
      background: var(--bg-color);
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--info-bg);
      border-radius: 6px;
      margin-bottom: 16px;
    }
    
    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
    
    .header-title .icon {
      font-size: 20px;
    }
    
    .header-actions {
      display: flex;
      gap: 8px;
    }
    
    .btn {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: opacity 0.2s;
    }
    
    .btn:hover {
      opacity: 0.9;
    }
    
    .btn-primary {
      background: var(--button-bg);
      color: var(--button-fg);
    }
    
    .btn-success {
      background: var(--success-color);
      color: white;
    }
    
    .btn-outline {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--fg-color);
    }
    
    .btn-outline:hover {
      background: var(--info-bg);
    }
    
    .info-banner {
      background: var(--info-bg);
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 16px;
      border-left: 3px solid var(--warning-color);
    }
    
    .info-banner p {
      margin: 0;
      font-size: 13px;
    }
    
    .content-wrapper {
      position: relative;
    }
    
    .content {
      background: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.1));
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
    }
    
    .content-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: rgba(0,0,0,0.1);
      border-bottom: 1px solid var(--border-color);
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    
    .content-body {
      padding: 16px;
      overflow-x: auto;
    }
    
    .content-body pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 13px);
    }
    
    .edit-mode .content-body {
      padding: 0;
    }
    
    .edit-mode textarea {
      width: 100%;
      min-height: 400px;
      padding: 16px;
      border: none;
      background: transparent;
      color: var(--fg-color);
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 13px);
      resize: vertical;
      line-height: 1.5;
    }
    
    .edit-mode textarea:focus {
      outline: none;
    }
    
    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    
    .status-modified {
      color: var(--warning-color);
    }
    
    .btn-danger {
      background: #dc3545;
      color: white;
    }
    
    .action-bar {
      display: flex;
      gap: 12px;
      padding: 16px;
      background: var(--info-bg);
      border-radius: 6px;
      margin-bottom: 16px;
      align-items: center;
    }
    
    .action-bar-label {
      font-weight: 600;
      margin-right: 8px;
    }
    
    .reject-panel {
      display: none;
      padding: 12px 16px;
      background: rgba(220, 53, 69, 0.1);
      border: 1px solid #dc3545;
      border-radius: 6px;
      margin-bottom: 16px;
    }
    
    .reject-panel.visible {
      display: block;
    }
    
    .reject-panel textarea {
      width: 100%;
      min-height: 80px;
      padding: 8px;
      margin: 8px 0;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--bg-color);
      color: var(--fg-color);
      font-family: inherit;
      resize: vertical;
    }
    
    .reject-panel-actions {
      display: flex;
      gap: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-title">
        <span class="icon">📄</span>
        <span id="fileName">${fileName}</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" onclick="copyContent()">📋 Copy</button>
        <button class="btn btn-outline" onclick="toggleEditMode()">✏️ Edit</button>
        <button class="btn btn-outline" onclick="openInDefaultEditor()">📝 Open in Editor</button>
        <button class="btn btn-success" onclick="saveFile()">💾 Save</button>
      </div>
    </div>
    
    <!-- Review Actions -->
    <div class="action-bar">
      <span class="action-bar-label">Review:</span>
      <button class="btn btn-success" onclick="approveArtifact()">✅ Approve</button>
      <button class="btn btn-danger" onclick="showRejectPanel()">❌ Reject</button>
    </div>
    
    <!-- Reject Feedback Panel -->
    <div class="reject-panel" id="rejectPanel">
      <strong>Provide feedback for rejection:</strong>
      <textarea id="rejectFeedback" placeholder="What needs to be changed?"></textarea>
      <div class="reject-panel-actions">
        <button class="btn btn-danger" onclick="submitReject()">Submit Rejection</button>
        <button class="btn btn-outline" onclick="hideRejectPanel()">Cancel</button>
      </div>
    </div>
    
    <div class="info-banner">
      <p>📋 <strong>Larry Artifact</strong> — This file is generated by Larry. You can review, edit, and save changes directly.</p>
    </div>
    
    <div class="content-wrapper">
      <div class="content" id="contentContainer">
        <div class="content-header">
          <span>${language}</span>
          <span id="lineCount">${content.split('\n').length} lines</span>
        </div>
        <div class="content-body" id="contentBody">
          <pre id="contentPre">${escapeHtml(content)}</pre>
        </div>
      </div>
    </div>
    
    <div class="status-bar">
      <span id="statusText">Ready</span>
      <span id="modifiedIndicator"></span>
    </div>
  </div>
  
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    
    let originalContent = ${JSON.stringify(content)};
    let currentContent = originalContent;
    let isEditMode = false;
    let isModified = false;
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    function toggleEditMode() {
      isEditMode = !isEditMode;
      const container = document.getElementById('contentContainer');
      const contentBody = document.getElementById('contentBody');
      
      if (isEditMode) {
        container.classList.add('edit-mode');
        contentBody.innerHTML = '<textarea id="editor" spellcheck="false">' + escapeHtml(currentContent) + '</textarea>';
        
        const editor = document.getElementById('editor');
        editor.addEventListener('input', () => {
          currentContent = editor.value;
          checkModified();
        });
        editor.focus();
      } else {
        container.classList.remove('edit-mode');
        contentBody.innerHTML = '<pre id="contentPre">' + escapeHtml(currentContent) + '</pre>';
      }
    }
    
    function checkModified() {
      isModified = currentContent !== originalContent;
      const indicator = document.getElementById('modifiedIndicator');
      indicator.textContent = isModified ? '● Modified' : '';
      indicator.className = isModified ? 'status-modified' : '';
    }
    
    function saveFile() {
      if (isEditMode) {
        const editor = document.getElementById('editor');
        currentContent = editor.value;
      }
      
      vscode.postMessage({ type: 'edit', content: currentContent });
      vscode.postMessage({ type: 'save' });
      
      originalContent = currentContent;
      isModified = false;
      checkModified();
      
      document.getElementById('statusText').textContent = 'Saved!';
      setTimeout(() => {
        document.getElementById('statusText').textContent = 'Ready';
      }, 2000);
    }
    
    function copyContent() {
      vscode.postMessage({ type: 'copyToClipboard', content: currentContent });
    }
    
    function openInDefaultEditor() {
      vscode.postMessage({ type: 'openInDefaultEditor' });
    }
    
    // ================================================================
    // Approve / Reject Actions
    // ================================================================
    
    function approveArtifact() {
      // Save first, then approve
      if (isEditMode) {
        const editor = document.getElementById('editor');
        currentContent = editor.value;
      }
      vscode.postMessage({ type: 'edit', content: currentContent });
      vscode.postMessage({ type: 'save' });
      vscode.postMessage({ type: 'approve' });
      
      document.getElementById('statusText').textContent = '✅ Approved!';
      setTimeout(() => {
        document.getElementById('statusText').textContent = 'Ready';
      }, 3000);
    }
    
    function showRejectPanel() {
      document.getElementById('rejectPanel').classList.add('visible');
      document.getElementById('rejectFeedback').focus();
    }
    
    function hideRejectPanel() {
      document.getElementById('rejectPanel').classList.remove('visible');
      document.getElementById('rejectFeedback').value = '';
    }
    
    function submitReject() {
      const feedback = document.getElementById('rejectFeedback').value;
      if (!feedback.trim()) {
        alert('Please provide feedback for the rejection.');
        return;
      }
      
      vscode.postMessage({ type: 'reject', feedback: feedback });
      hideRejectPanel();
      
      document.getElementById('statusText').textContent = '❌ Rejected with feedback';
      setTimeout(() => {
        document.getElementById('statusText').textContent = 'Ready';
      }, 3000);
    }
    
    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      if (message.type === 'update') {
        originalContent = message.content;
        currentContent = message.content;
        isModified = false;
        
        document.getElementById('fileName').textContent = message.fileName;
        document.getElementById('lineCount').textContent = message.content.split('\\n').length + ' lines';
        
        if (!isEditMode) {
          document.getElementById('contentPre').innerHTML = escapeHtml(message.content);
        } else {
          document.getElementById('editor').value = message.content;
        }
        
        checkModified();
      }
    });
  </script>
</body>
</html>`;
  }
}

/**
 * Generates a random nonce for CSP
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

