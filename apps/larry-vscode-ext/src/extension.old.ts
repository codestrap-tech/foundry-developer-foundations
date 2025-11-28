import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { findProjectRoot } from './findProjectRoot';
import path from 'path';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as net from 'net';

const execAsync = promisify(exec);

interface LarryConfig {
  name: string;
  agents: Record<string, string>;
  workspaceSetupCommand: string[];
  larryEnvPath: string;
}

let dockerImageName = process.env.REPO_ROOT ? `${process.env.REPO_ROOT}-larry-server` : 'larry-server'; 

let projectName: string | undefined;

let defaultMainPort = 4210;
let defaultWorktreePort = 4220;

/*
PORT_RANGE - how many CSP ports to allow to communicate with
Generates all ports in the range dynamically:
Worktree ports: 4220-4319 (100 ports)
Main ports: 4210-4309 (100 ports)
Creates space-separated URLs for all these ports
Includes them in the connect-src directive of the CSP policy
*/
const PORT_RANGE = 100; 

loadLarryConfig().then(async (config) => {
  projectName = config.name;
  dockerImageName = projectName ? `${projectName}-larry-server` : 'larry-server'; 
}).catch((error) => {
  console.error('Error loading larry config:', error);
});

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    console.log(`Port ${port} is taken, trying next port...`);
    port++;
  }
  return port;
}

async function loadLarryConfig(): Promise<LarryConfig> {
  const projectRoot = await findProjectRoot();
  if (!projectRoot) {
    throw new Error('Project root not found. Cannot load larry.config.json');
  }

  const configPath = path.join(projectRoot, 'larry.config.json');
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`larry.config.json not found at: ${configPath}`);
  }
  
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent) as LarryConfig;
    
    if (!config || !config.agents || Object.keys(config.agents).length === 0) {
      throw new Error('Invalid larry.config.json: agents configuration is required');
    }
    
    return config;
  } catch (error) {
    if (error instanceof Error && error.message.includes('larry.config.json')) {
      throw error;
    }
    throw new Error(`Failed to parse larry.config.json: ${error instanceof Error ? error.message : error}`);
  }
}

// --- SSE relay (extension host) ---
class SSEProxy {
  private req?: http.ClientRequest;
  private res?: http.IncomingMessage;
  private buffer = '';
  private retryCount = 0;
  private maxRetries = 10;
  private retryDelay = 2000; // 2 seconds
  private retryTimeout?: NodeJS.Timeout;
  private stopped = false;

  start(
    url: string,
    onEvent: (evt: { event?: string; data: string }) => void,
    onError: (e: any) => void
  ) {
    this.stopped = false;
    this.connect(url, onEvent, onError);
  }

  private connect(
    url: string,
    onEvent: (evt: { event?: string; data: string }) => void,
    onError: (e: any) => void
  ) {
    if (this.stopped) return;

    const lib = url.startsWith('https:') ? https : http;

    this.req = lib.request(
      url,
      { headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' } },
      (res) => {
        this.res = res;
        res.setEncoding('utf8');

        console.log('SSE connection established', url);
        // Reset retry count on successful connection
        this.retryCount = 0;

        res.on('data', (chunk: string) => {
          this.buffer += chunk;
          let idx: number;
          while ((idx = this.buffer.indexOf('\n\n')) >= 0) {
            const frame = this.buffer.slice(0, idx);
            this.buffer = this.buffer.slice(idx + 2);

            let eventName: string | undefined;
            const dataLines: string[] = [];
            for (const line of frame.split(/\r?\n/)) {
              if (!line || line.startsWith(':')) continue;
              if (line.startsWith('event:')) eventName = line.slice(6).trim();
              else if (line.startsWith('data:'))
                dataLines.push(line.slice(5).trim());
            }

            if (eventName) {
              // handle only named events
              console.log('Bypassing SEE event:', eventName);
              onEvent({ event: eventName, data: dataLines.join('\n') });
            }
          }
        });

        res.on('end', () =>
          this.handleError(new Error('SSE ended'), url, onEvent, onError)
        );
      }
    );

    this.req.on('error', (err) => this.handleError(err, url, onEvent, onError));
    this.req.end();
  }

  private handleError(
    error: any,
    url: string,
    onEvent: (evt: { event?: string; data: string }) => void,
    onError: (e: any) => void
  ) {
    if (this.stopped) return;

    console.log(
      `❌ SSE connection error (attempt ${this.retryCount + 1}/${
        this.maxRetries + 1
      }):`,
      error
    );

    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(
        `🔄 Retrying SSE connection in ${this.retryDelay}ms... (${this.retryCount}/${this.maxRetries})`
      );

      this.retryTimeout = setTimeout(() => {
        this.connect(url, onEvent, onError);
      }, this.retryDelay);
    } else {
      console.log(`❌ SSE connection failed after ${this.maxRetries} retries`);
      onError(error);
    }
  }

  stop() {
    this.stopped = true;
    this.retryCount = 0;

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = undefined;
    }

    try {
      this.req?.destroy();
    } catch {}
    try {
      this.res?.destroy();
    } catch {}
  }
}

export function activate(context: vscode.ExtensionContext) {
  try {
    console.log('🚀 Larry Extension activation started...');

    const provider = new LarryViewProvider(context);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider('larryHome', provider, {
        webviewOptions: { retainContextWhenHidden: true },
      })
    );

    // Watch for workspace changes to detect worktree changes
    const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(
      () => {
        try {
          provider.notifyWorktreeChange();
        } catch (error) {
          console.error('❌ Error in worktree change handler:', error);
        }
      }
    );
    context.subscriptions.push(workspaceWatcher);

    console.log('🚀 Larry Extension activated successfully!');
    console.log(
      '📁 Workspace folders:',
      vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath)
    );

    // Show a notification to confirm activation (with error handling)
    vscode.window
      .showInformationMessage('Larry Coding Assistant is now active!')
      .then(
        () => console.log('✅ Activation notification shown'),
        (error) => console.error('❌ Failed to show notification:', error)
      );

    // Note: Docker will be started when the webview is actually opened/used
  } catch (error) {
    console.error('❌ Critical error during extension activation:', error);
    vscode.window.showErrorMessage(
      `Larry Extension failed to activate: ${error}`
    );
  }
}

class LarryViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private runningContainers: Map<string, string> = new Map(); // threadId -> containerId
  private mainDockerContainer: string | undefined; // Main docker container for port 4210

  private sseWorktree?: SSEProxy;
  private sseLarryStreams: Map<string, SSEProxy> = new Map();

  private config?: LarryConfig;
  private configLoaded: Promise<void>;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.configLoaded = loadLarryConfig()
      .then((config) => {
        this.config = config;
        console.log('Larry config initialized:', this.config);
      })
      .catch((error) => {
        vscode.window.showErrorMessage(
          `Larry Extension: ${error.message}. Please create a larry.config.json file in your project root.`
        );
        throw error;
      });
  }

  private startMainSSE() {
    // topics we need for main list view
    console.log('Main SSE not needed for now...');
  }

  private startWorktreeSSE(agentKey?: string) {
    if (!this.config) {
      console.error('❌ Config not loaded, cannot start SSE');
      return;
    }
    
    const agent = agentKey || Object.keys(this.config.agents)[0];
    const agentRoute = this.config.agents[agent];
    
    const url = `http://localhost:${defaultWorktreePort}${agentRoute}/events?topics=thread.created,machine.updated`;
    console.log('🚀 Starting worktree SSE connection to:', url);
    this.sseWorktree?.stop();
    this.sseWorktree = new SSEProxy();
    this.sseWorktree.start(
      url,
      (ev) => {
        console.log('📤 Forwarding worktree SSE event to webview:', ev);
        this.view?.webview.postMessage({
          type: 'sse_event',
          baseUrl: `http://localhost:${defaultWorktreePort}${agentRoute}`,
          event: ev.event || 'message',
          data: ev.data,
        });
      },
      (err) => {
        console.log(
          '❌ Worktree SSE connection failed after all retries:',
          err
        );
        this.view?.webview.postMessage({
          type: 'sse_error',
          source: 'worktree',
          message: `Connection failed after 3 retries: ${String(
            err?.message || err
          )}`,
          retryable: true,
        });
      }
    );
  }

  private startLarryStream(streamId: string, baseUrl: string) {
    this.stopLarryStream(streamId);

    const url = `${baseUrl}/larry/${streamId}/events`;

    const proxy = new SSEProxy();
    this.sseLarryStreams.set(streamId, proxy);

    proxy.start(
      url,
      (ev) => {
        this.view?.webview.postMessage({
          type: 'larry_stream_event',
          streamId,
          event: ev.event || 'message',
          data: ev.data,
        });
      },
      (err) => {
        this.view?.webview.postMessage({
          type: 'larry_stream_error',
          streamId,
          message: `Connection failed: ${String(err?.message || err)}`,
        });
      }
    );
  }

  private stopLarryStream(streamId: string) {
    const proxy = this.sseLarryStreams.get(streamId);
    if (proxy) {
      proxy.stop();
      this.sseLarryStreams.delete(streamId);
    }
  }

  // Thread ID file management
  private async readCurrentThreadId(
    worktreeName: string
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
        'worktreeLocalThreads.json'
      );

      const fileContent = await vscode.workspace.fs.readFile(threadIdsFilePath);
      const threadIds = JSON.parse(fileContent.toString());
      return Array.isArray(threadIds) ? threadIds : [];
    } catch (error) {
      // File doesn't exist or can't be read
      return undefined;
    }
  }

  private async writeCurrentThreadId(
    worktreeName: string,
    threadId: string
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
        'tmp'
      );

      // Create tmp directory if it doesn't exist
      await vscode.workspace.fs.createDirectory(tmpDir);

      const threadIdsFilePath = vscode.Uri.joinPath(
        tmpDir,
        'worktreeLocalThreads.json'
      );

      // Read existing thread IDs or initialize empty array
      let existingThreadIds: string[] = [];
      try {
        const fileContent = await vscode.workspace.fs.readFile(
          threadIdsFilePath
        );
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
        Buffer.from(JSON.stringify(existingThreadIds, null, 2), 'utf8')
      );
    } catch (error) {
      console.error('Error writing thread ID file:', error);
    }
  }

  // Main Docker management methods
  private async ensureMainDockerRunning(): Promise<void> {
    try {
      // Check if main docker is already running
      if (this.mainDockerContainer) {
        try {
          const { stdout: inspectOutput } = await execAsync(`docker inspect ${this.mainDockerContainer}`);
          const containerInfo = JSON.parse(inspectOutput);
          const portKey = Object.keys(containerInfo[0].NetworkSettings.Ports)[0];
          defaultMainPort = containerInfo[0].NetworkSettings.Ports[portKey][0].HostPort;
          console.log(
            'Main docker container already running:',
            this.mainDockerContainer
          );
          return;
        } catch (error) {
          // Container doesn't exist, clear the reference
          this.mainDockerContainer = undefined;
        }
      }

      // Start main docker container
      await this.startMainDockerContainer();
    } catch (error) {
      console.error('Error ensuring main docker is running:', error);
    }
  }

  private async startMainDockerContainer(): Promise<void> {
    try {
      await this.ensureLarryDockerImage();

      const foundryProjectRoot = await findProjectRoot();
      if (!foundryProjectRoot) {
        throw new Error('Project root not found.');
      }

      const containerName = `${projectName || 'larry'}-main-server`;

      // Clean up existing container if any
      try {
        await execAsync(`docker rm -f ${containerName}`);
        console.log(`Cleaned up existing main container: ${containerName}`);
      } catch (cleanupError) {
        // Container doesn't exist, which is fine
      }

      // Find available port starting from default
      const port = await findAvailablePort(defaultMainPort);
      console.log(`Starting main container on port ${port}`);

      // Start main container
      const { stdout } = await execAsync(
        `docker run -d --name ${containerName} \
   -p ${port}:${port} \
   -e PORT=${port} \
   -v "${foundryProjectRoot}:/workspace:ro" \
   --user 1001:1001 \
   ${dockerImageName}`
      );

      const containerId = stdout.trim();
      this.mainDockerContainer = containerId;

      console.log('Main Larry container started:', containerId);
    } catch (error) {
      console.error('Error starting main Larry container:', error);
      throw error;
    }
  }

  private async stopMainDockerContainer(): Promise<void> {
    try {
      if (!this.mainDockerContainer) {
        return;
      }

      const containerName = `${projectName || 'larry'}-main-server`;

      // Stop and remove container
      await execAsync(`docker stop ${containerName}`);
      await execAsync(`docker rm ${containerName}`);

      this.mainDockerContainer = undefined;
      console.log('Main Larry container stopped');
    } catch (error) {
      console.error('Error stopping main Larry container:', error);
    }
  }

  private transformSessionNameToBranchName(sessionName: string): string {
    return sessionName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 50); // Limit length
  }

  async getCurrentWorktreeId(): Promise<string> {
    try {
      // Get the current workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        console.log('No workspace folder found');
        return '';
      }

      console.log(
        'Checking worktree for workspace:',
        workspaceFolder.uri.fsPath
      );

      // Check if we're in a git worktree by looking for .git file (worktree) vs .git directory (main)
      const gitPath = vscode.Uri.joinPath(workspaceFolder.uri, '.git');

      try {
        const gitStat = await vscode.workspace.fs.stat(gitPath);

        if (gitStat.type === vscode.FileType.File) {
          const gitContent = await vscode.workspace.fs.readFile(gitPath);
          const gitDir = gitContent.toString().trim();
          console.log('Git dir content:', gitDir);

          const worktreeMatch = gitDir.match(/worktrees\/([^\/]+)/);
          if (worktreeMatch) {
            return worktreeMatch[1]; // Return the actual worktree name
          } else {
            const worktreeName = gitDir.split('/').pop() || 'unknown';
            return worktreeName;
          }
        } else {
          return await this.getCurrentBranchName(workspaceFolder.uri.fsPath);
        }
      } catch (gitError) {
        // If .git is a directory, we're in the main repository, get current branch
        return await this.getCurrentBranchName(workspaceFolder.uri.fsPath);
      }
    } catch (error) {
      console.error('Error detecting worktree:', error);
      return '';
    }
  }

  async getCurrentBranchName(repoPath: string): Promise<string> {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      // Get current branch name
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

  async notifyWorktreeChange() {
    if (!this.view) return;

    const worktreeId = await this.getCurrentWorktreeId();
    const isInWorktree = await this.isInWorktree();
    let currentThreadId: string | undefined;

    // If in worktree, try to read thread ID from file
    if (isInWorktree && worktreeId) {
      try {
        const threadIds = await this.readCurrentThreadId(worktreeId);
        // Use the most recent thread ID (last in the array) if available
        currentThreadId =
          threadIds && threadIds.length > 0
            ? threadIds[threadIds.length - 1]
            : undefined;
      } catch (error) {
        console.error('Error reading thread ID for worktree:', error);
      }

      const containerName = `${projectName || 'larry'}-worktree-${worktreeId}`;
      try {
        const { stdout: inspectOutput } = await execAsync(
          `docker inspect ${containerName}`
        );
        const containerInfo = JSON.parse(inspectOutput);

        console.log('Container info:', containerInfo);

        if (containerInfo.length > 0) {
          const container = containerInfo[0];
          const isRunning = container.State.Running;
          const containerId = container.Id;
          
          const portKey = Object.keys(container.NetworkSettings.Ports)[0];
          defaultWorktreePort = container.NetworkSettings.Ports[portKey][0].HostPort;

          if (!isRunning) {
            await execAsync(`docker start ${containerId}`);
            this.runningContainers.set(worktreeId, containerId);
          } else {
            this.runningContainers.set(worktreeId, containerId);
          }
        }
      } catch (inspectError) {
        console.error('Error inspecting container:', inspectError);
        await this.startWorktreeDockerContainer(worktreeId, undefined, true);
      }
    }

    const message = {
      type: 'worktree_detection',
      isInWorktree,
      currentThreadId: currentThreadId || undefined,
      worktreeName: worktreeId,
      worktreePort: defaultWorktreePort,
      mainPort: defaultMainPort,
    };

    console.log('📤 Sending message to webview:', message);
    this.view.webview.postMessage(message);
    console.log('📤 Message sent successfully');

    // Start appropriate SSE based on worktree state
    if (!isInWorktree) {
      console.log(
        '🐳 User is not in worktree - starting main Docker container...'
      );
      await this.ensureMainDockerRunning();
      this.startMainSSE(); // <— start SSE for main list
    } else {
      console.log('🌿 User is in worktree - starting worktree SSE');
      this.startWorktreeSSE(); // <— start SSE for worktree
    }
  }

  async isInWorktree(): Promise<boolean> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return false;
      }

      // Check if we're in a git worktree by looking for .git file (worktree) vs .git directory (main)
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

  async handleOpenWorktree(
    worktreeName: string,
    threadId: string | undefined,
    label: string,
    agentKey?: string
  ) {
    try {
      // Create or ensure worktree exists
      const finalWorktreeName = await this.createOrEnsureWorktree(
        worktreeName,
        threadId,
        label
      );

      if (!finalWorktreeName) {
        throw new Error('Failed to create or find worktree');
      }

      let isRunning = false;
      try {
        const containerName = `${projectName || 'larry'}-worktree-${finalWorktreeName}`;
      const { stdout: inspectOutput } = await execAsync(
        `docker inspect ${containerName}`
      );

      const containerInfo = JSON.parse(inspectOutput);
      if (containerInfo.length > 0) {
        const container = containerInfo[0];
        isRunning = container.State.Running;
      }
      } catch (e) {
        isRunning = false;
      }
      

      if (!isRunning) {
      // Setup worktree environment
      await this.setupWorktreeEnvironment(finalWorktreeName, threadId);

      // Start worktree docker container
      this.view?.webview.postMessage({
        type: 'update_thread_state',
        state: 'creating_container',
      });

      if (threadId) {
        await this.writeCurrentThreadId(finalWorktreeName, threadId);
      }

      await this.startWorktreeDockerContainer(finalWorktreeName, threadId);
      }

      // Notify that worktree is ready
      this.view?.webview.postMessage({
        type: 'worktree_ready',
        worktreeName: finalWorktreeName,
        threadId,
      });

      setTimeout(() => {
        // This one will need to be refactored because user should be able to select agent per thread, not per worktree
        this.startWorktreeSSE(agentKey); // <— start SSE for worktree events with selected agent
        this.openWorktree(finalWorktreeName);
        this.view?.webview.postMessage({
          type: 'update_thread_state',
          state: 'ready',
        });
      }, 3000);
    } catch (error) {
      console.error('Error handling open worktree:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Show VSCode toast notification
      vscode.window.showErrorMessage(
        `Failed to setup worktree: ${errorMessage}`
      );

      this.view?.webview.postMessage({
        type: 'worktree_setup_error',
        error: errorMessage,
        worktreeName,
        threadId,
      });
    }
  }

  async createOrEnsureWorktree(
    worktreeName: string,
    threadId: string | undefined,
    label: string
  ): Promise<string | undefined> {
    try {
      // Get workspace folder
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
          this.transformSessionNameToBranchName(label) +
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
        this.view?.webview.postMessage({
          type: 'update_thread_state',
          state: 'creating_worktree',
        });
        // Create worktree
        await this.createWorktreeInternal(
          workspaceFolder,
          finalWorktreeName,
          threadId,
          label
        );
      }

      return finalWorktreeName;
    } catch (error) {
      console.error('Error creating or ensuring worktree:', error);
      throw error;
    }
  }

  async createWorktreeInternal(
    workspaceFolder: vscode.WorkspaceFolder,
    worktreeName: string,
    threadId: string | undefined,
    label: string
  ) {
    try {
      // Create worktree directory path
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
      let worktreeCreated = false;

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
        worktreeCreated = true;
      } catch (branchError: any) {
        // If branch already exists, try to use existing branch
        if (branchError.message?.includes('already exists')) {
          console.log(
            `Branch ${branchName} already exists, trying to use existing branch`
          );
          try {
            await execAsync(
              `git worktree add "${worktreePath.fsPath}" ${branchName}`,
              { cwd: workspaceFolder.uri.fsPath }
            );
            worktreeCreated = true;
          } catch (existingBranchError: any) {
            if (existingBranchError.message?.includes('already checked out')) {
              throw new Error(
                `Worktree path already exists: ${worktreePath.fsPath}`
              );
            } else {
              throw existingBranchError;
            }
          }
        } else {
          throw branchError;
        }
      }

      if (worktreeCreated) {
        // Write thread ID to file only if provided (existing worktree case)
        if (threadId && threadId.trim() !== '') {
          try {
            await this.writeCurrentThreadId(worktreeName, threadId);
            console.log(
              `Worktree created: ${worktreeName} (branch: ${branchName}) with thread ID: ${threadId}`
            );
          } catch (error) {
            console.error('Failed to write thread ID file:', error);
          }
        } else {
          // New worktree - no thread ID file created yet
          console.log(
            `New worktree created: ${worktreeName} (branch: ${branchName}) - thread ID will be assigned later`
          );
        }
      }
    } catch (error) {
      console.error('Error creating worktree:', error);
      throw error;
    }
  }

  async setupWorktreeEnvironment(worktreeName: string, threadId?: string) {
    try {
      if (!this.config) {
        throw new Error('Config not loaded');
      }

      this.view?.webview.postMessage({
        type: 'update_thread_state',
        state: 'setting_up_environment',
      });

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

 
      if (this.config.larryEnvPath) {
        console.log(`Copying env file from ${this.config.larryEnvPath}...`);
        const sourceEnvPath = vscode.Uri.joinPath(
          workspaceFolder.uri,
          this.config.larryEnvPath
        ).fsPath;
        const targetEnvPath = path.join(worktreePath, this.config.larryEnvPath);
        
        await execAsync(`cp ${sourceEnvPath} ${targetEnvPath}`);
      }

      // Run workspace setup commands sequentially
      for (const command of this.config.workspaceSetupCommand) {
        console.log(`Running workspace setup command: ${command}`);
        await execAsync(command, { cwd: worktreePath });
      }

      console.log('Worktree environment setup completed');
    } catch (error) {
      console.error('Error setting up worktree environment:', error);
      throw error;
    }
  }

  async startWorktreeDockerContainer(
    worktreeName: string,
    threadId: string | undefined,
    isInWorktree?: boolean
  ): Promise<string> {
    try {
      // Ensure Docker image exists before running
      await this.ensureLarryDockerImage();

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      const containerName = `${projectName || 'larry'}-worktree-${worktreeName}`;

      try {
        await execAsync(`docker rm -f ${containerName}`);
        console.log(`Cleaned up existing worktree container: ${containerName}`);
      } catch (cleanupError) {
        // Container doesn't exist, which is fine
      }

      const worktreePath = !isInWorktree
        ? vscode.Uri.joinPath(
            workspaceFolder.uri,
            '.larry',
            'worktrees',
            worktreeName
          ).fsPath
        : vscode.Uri.joinPath(workspaceFolder.uri, '').fsPath;
      console.log(worktreePath);

      // Find available port starting from default
      const port = await findAvailablePort(defaultWorktreePort);
      console.log(`Starting worktree container on port ${port}`);

      // Start worktree container
      const threadIdEnv = threadId ? `-e THREAD_ID=${threadId}` : '';
      const { stdout } = await execAsync(
        `docker run -d --name ${containerName} \
   -p ${port}:${port} \
   -e PORT=${port} \
   ${threadIdEnv} \
   -e WORKTREE_NAME=${worktreeName} \
   -v "${worktreePath}:/workspace:rw" \
   --user 1001:1001 \
   ${dockerImageName}`
      );

      const containerId = stdout.trim();
      // Use worktree name as key since threadId might be undefined
      this.runningContainers.set(worktreeName, containerId);

      console.log(
        `Worktree Larry container started for ${worktreeName}:`,
        containerId
      );
      return containerId;
    } catch (error) {
      console.error('Error starting worktree Larry container:', error);
      throw error;
    }
  }

  async openWorktree(worktreeId: string) {
    try {
      // Get the main repository path
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
        worktreeId
      ).fsPath;

      // Convert relative path to absolute path
      const absoluteWorktreePath = worktreePath.startsWith('.')
        ? vscode.Uri.joinPath(workspaceFolder.uri, worktreePath).fsPath
        : worktreePath;

      // Check if worktree exists
      const worktreeExists = await vscode.workspace.fs
        .stat(vscode.Uri.file(absoluteWorktreePath))
        .then(
          () => true,
          () => false
        );

      if (!worktreeExists) {
        // Worktree doesn't exist, ask user if they want to create it
        const createWorktree = await vscode.window.showWarningMessage(
          `Worktree doesn't exist at: ${worktreePath}`,
          'Create Worktree',
          'Cancel'
        );

        if (createWorktree === 'Create Worktree') {
          vscode.window.showInformationMessage(
            'Please use the "Open worktree" flow in the extension to create worktrees.'
          );
        } else {
          return;
        }
      }

      await vscode.commands.executeCommand(
        'vscode.openFolder',
        vscode.Uri.file(absoluteWorktreePath),
        true
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open worktree: ${error}`);
    }
  }

  async openFile(filePath: string) {
    // Handle Docker container paths that start with /workspace
    let resolvedPath = filePath;

    if (filePath.startsWith('/workspace/')) {
      // Get the current workspace root
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        // Replace /workspace with the actual workspace root path
        resolvedPath = filePath.replace(
          '/workspace/',
          workspaceFolder.uri.fsPath + '/'
        );
      }
    }

    await vscode.commands.executeCommand(
      'vscode.open',
      vscode.Uri.file(resolvedPath)
    );
  }

  async readFileContent(filePath: string) {
    // Handle Docker container paths that start with /workspace
    let resolvedPath = filePath;

    if (filePath.startsWith('/workspace/')) {
      // Get the current workspace root
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        // Replace /workspace with the actual workspace root path
        resolvedPath = filePath.replace(
          '/workspace/',
          workspaceFolder.uri.fsPath + '/'
        );
      }
    }

    const fileContent = await vscode.workspace.fs.readFile(
      vscode.Uri.file(resolvedPath)
    );
    return Buffer.from(fileContent).toString('utf8');
  }

  private async ensureLarryDockerImage(): Promise<void> {
    try {
      console.log(`Checking if Docker image ${dockerImageName} exists...`);
      await execAsync(`docker image inspect ${dockerImageName}`);
    } catch (error) {
      // Image doesn't exist, build it
      console.log(`Docker image ${dockerImageName} not found, building...`);
      const foundryProjectRoot = await findProjectRoot();
      if (!foundryProjectRoot) {
        throw new Error('Project root not found for Docker build.');
      }

      await execAsync(`docker build -f Larry.Dockerfile -t ${dockerImageName} .`, {
        cwd: foundryProjectRoot,
      });
      console.log(`Docker image ${dockerImageName} built successfully`);
    }
  }

  resolveWebviewView(view: vscode.WebviewView) {
    console.log('🎯 Larry webview opened by user - initializing...');
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ],
    };

    const scriptUri = view.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js')
    );
    const styleUri = view.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.css')
    );
    const overridesUri = view.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'overrides.css')
    );
    const nonce = String(Date.now());
    
    const worktreePorts = Array.from({ length: PORT_RANGE }, (_, i) => 
      `http://localhost:${defaultWorktreePort + i}`
    ).join(' ');
    const mainPorts = Array.from({ length: PORT_RANGE }, (_, i) => 
      `http://localhost:${defaultMainPort + i}`
    ).join(' ');
    
    const csp = [
      "default-src 'none'",
      `img-src ${view.webview.cspSource} https: data:`,
      `style-src ${view.webview.cspSource} 'unsafe-inline'`,
      `font-src ${view.webview.cspSource} https:`,
      `script-src 'nonce-${nonce}' ${view.webview.cspSource}`,
      `connect-src 'self' ${view.webview.cspSource} ${worktreePorts} ${mainPorts}`,
    ].join('; ');

    view.webview.html = `<!DOCTYPE html>
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

    view.webview.onDidReceiveMessage(async (msg) => {
      // New flow message handlers
      if (msg?.type === 'reload_extension') {
        console.log('🔄 Reloading extension...');
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
        return;
      }

      if (msg?.type === 'open_worktree') {
        await this.handleOpenWorktree(
          msg.worktreeName || '',
          msg.threadId || undefined,
          msg.label,
          msg.agentKey || undefined
        );
        return;
      }

      // Keep only essential legacy handlers for basic functionality
      if (msg?.type === 'getCurrentWorktree') {
        await this.notifyWorktreeChange();
        return;
      }

      if (msg?.type === 'openFile') {
        await this.openFile(msg.file);
        return;
      }

      if (msg?.type === 'saveThreadId') {
        await this.writeCurrentThreadId(msg.worktreeName, msg.threadId);
        const threadIds = await this.readCurrentThreadId(msg.worktreeName);

        view.webview.postMessage({
          type: 'threadIds',
          worktreeName: msg.worktreeName,
          threadIds: threadIds,
        });
        view.webview.postMessage({
          type: 'threadIdSaved',
          worktreeName: msg.worktreeName,
          threadId: msg.threadId,
        });
        return;
      }

      if (msg?.type === 'readThreadIds') {
        const threadIds = await this.readCurrentThreadId(msg.worktreeName);
        view.webview.postMessage({
          type: 'threadIds',
          worktreeName: msg.worktreeName,
          threadIds: threadIds,
        });
        return;
      }

      if (msg?.type === 'getConfig') {
        view.webview.postMessage({
          type: 'config_loaded',
          config: this.config,
          worktreePort: defaultWorktreePort,
          mainPort: defaultMainPort,
        });
        return;
      }

      if (msg?.type === 'start_larry_stream') {
        this.startLarryStream(msg.streamId, msg.baseUrl);
        return;
      }

      if (msg?.type === 'stop_larry_stream') {
        this.stopLarryStream(msg.streamId);
        return;
      }

      if (msg?.type === 'readFile') {
        const content = await this.readFileContent(msg.filePath);
        view.webview.postMessage({
          type: 'fileContent',
          filePath: msg.filePath,
          content: content,
        });
        return;
      }

      if (msg?.type === 'list_local_worktrees') {
        try {
          /*
            we need to check if we are in workspace (any repo), because
            without that when extension is being run in empty folder
            (e.g VS Code start screen) then it will crash
          */
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            view.webview.postMessage({
              type: 'local_worktrees_response',
              worktrees: [],
            });
            return;
          }

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
            .filter((item) => item !== null);

          view.webview.postMessage({
            type: 'local_worktrees_response',
            worktrees,
          });
        } catch (error) {
          console.error('Error listing local worktrees:', error);
          view.webview.postMessage({
            type: 'local_worktrees_response',
            worktrees: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return;
      }

      if (msg?.type === 'get_docker_status') {
        try {
          const containerName = `${projectName || 'larry'}-worktree-${msg.worktreeName}`;
          const { stdout: inspectOutput } = await execAsync(
            `docker inspect ${containerName}`
          );
          const containerInfo = JSON.parse(inspectOutput);

          if (containerInfo.length > 0) {
            const container = containerInfo[0];
            const isRunning = container.State.Running;
            const containerId = container.Id;

            view.webview.postMessage({
              type: 'docker_status_response',
              worktreeName: msg.worktreeName,
              isRunning,
              containerId,
            });
          } else {
            view.webview.postMessage({
              type: 'docker_status_response',
              worktreeName: msg.worktreeName,
              isRunning: false,
              containerId: undefined,
            });
          }
        } catch (error) {
          // Container doesn't exist - this is expected when manually deleted
          // Return stopped status without logging error
          view.webview.postMessage({
            type: 'docker_status_response',
            worktreeName: msg.worktreeName,
            isRunning: false,
            containerId: undefined,
          });
        }
        return;
      }

      if (msg?.type === 'start_docker_container') {
        try {
          await this.startWorktreeDockerContainer(msg.worktreeName, undefined, true);
          view.webview.postMessage({
            type: 'docker_action_complete',
            action: 'start',
            worktreeName: msg.worktreeName,
            success: true,
          });
        } catch (error) {
          console.error('Error starting docker container:', error);
          view.webview.postMessage({
            type: 'docker_action_complete',
            action: 'start',
            worktreeName: msg.worktreeName,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return;
      }

      if (msg?.type === 'stop_docker_container') {
        try {
          const containerName = `${projectName || 'larry'}-worktree-${msg.worktreeName}`;
          await execAsync(`docker stop ${containerName}`);
          view.webview.postMessage({
            type: 'docker_action_complete',
            action: 'stop',
            worktreeName: msg.worktreeName,
            success: true,
          });
        } catch (error) {
          console.error('Error stopping docker container:', error);
          view.webview.postMessage({
            type: 'docker_action_complete',
            action: 'stop',
            worktreeName: msg.worktreeName,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return;
      }

      if (msg?.type === 'delete_worktree') {
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            throw new Error('No workspace folder found');
          }

          const containerName = `${projectName || 'larry'}-worktree-${msg.worktreeName}`;

          // Stop and remove docker container
          try {
            await execAsync(`docker stop ${containerName}`);
          } catch (e) {
          }
          try {
            await execAsync(`docker rm -f ${containerName}`);
          } catch (e) {
          }

          // Remove git worktree
          const worktreePath = vscode.Uri.joinPath(
            workspaceFolder.uri,
            '.larry',
            'worktrees',
            msg.worktreeName
          ).fsPath;

          await execAsync(`git worktree remove "${worktreePath}" --force`, {
            cwd: workspaceFolder.uri.fsPath,
          });

          try {
            await vscode.workspace.fs.delete(
              vscode.Uri.file(worktreePath),
              { recursive: true }
            );
          } catch (e) {
          }

          await execAsync('git worktree prune', {
            cwd: workspaceFolder.uri.fsPath,
          });

          view.webview.postMessage({
            type: 'worktree_deleted',
            worktreeName: msg.worktreeName,
            success: true,
          });
        } catch (error) {
          console.error('Error deleting worktree:', error);
          view.webview.postMessage({
            type: 'worktree_deleted',
            worktreeName: msg.worktreeName,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return;
      }
    });

    // Initialize config and worktree detection when webview is opened
    console.log('🚀 Starting initial config loading and worktree detection...');

    // Add a small delay to ensure webview is ready to receive messages
    setTimeout(async () => {
      try {
        this.notifyWorktreeChange().catch((error) => {
          console.error('❌ Error in initial worktree detection:', error);
        });
      } catch (error) {
        console.error('❌ Failed to initialize extension:', error);
      }
    }, 100);
  }
}

export function deactivate() {
  // Cleanup main docker container if running
  // Note: This is a best-effort cleanup, errors are ignored
  try {
    // Stop SSE connections (if we keep a reference to provider)
    // For now, they'll be cleaned up when the extension process ends

    const { exec } = require('child_process');
    exec('docker rm -f larry-main-server', () => {
      // Ignore errors during cleanup
    });
  } catch (error) {
    // Ignore cleanup errors
  }
}
