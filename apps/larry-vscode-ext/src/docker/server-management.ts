import { exec } from 'child_process';
import { promisify } from 'util';
import * as net from 'net';
import { findProjectRoot } from '../findProjectRoot';
import {
  getDockerImageName,
  getMainContainerName,
  getWorktreeContainerName,
} from '../config/larry-config';
import type { ExtensionState, DockerContainerInfo } from '../types';

const execAsync = promisify(exec);

// ============================================================================
// Port Management
// ============================================================================

/**
 * Checks if a port is available
 */
export function isPortAvailable(port: number): Promise<boolean> {
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

/**
 * Finds an available port starting from startPort
 */
export async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    console.log(`Port ${port} is taken, trying next port...`);
    port++;
  }
  return port;
}

// ============================================================================
// Docker Image Management
// ============================================================================

/**
 * Ensures the Larry Docker image exists, building it if necessary
 */
export async function ensureLarryDockerImage(
  projectName: string | undefined
): Promise<void> {
  const dockerImageName = getDockerImageName(projectName);

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

    await execAsync(
      `docker build -f Larry.Dockerfile -t ${dockerImageName} .`,
      {
        cwd: foundryProjectRoot,
      }
    );
    console.log(`Docker image ${dockerImageName} built successfully`);
  }
}

// ============================================================================
// Container Inspection
// ============================================================================


/**
 * Gets information about a Docker container
 */
export async function inspectContainer(
  containerName: string
): Promise<DockerContainerInfo | null> {
  try {
    const { stdout: inspectOutput } = await execAsync(
      `docker inspect ${containerName}`
    );
    const containerInfo = JSON.parse(inspectOutput);

    if (containerInfo.length > 0) {
      const container = containerInfo[0];
      const portKey = Object.keys(container.NetworkSettings.Ports)[0];
      const port = container.NetworkSettings.Ports[portKey]?.[0]?.HostPort;

      return {
        id: container.Id,
        name: containerName,
        isRunning: container.State.Running,
        port: port ? parseInt(port, 10) : 4220,
      };
    }
    return null;
  } catch (error) {
    // Container doesn't exist
    return null;
  }
}

// ============================================================================
// Main Container Management
// ============================================================================

/**
 * Ensures the main Docker container is running
 * Updates state.mainPort and state.mainDockerContainer
 */
export async function ensureMainDockerRunning(
  state: ExtensionState
): Promise<void> {
  const projectName = state.config?.name;

  try {
    // Check if main docker is already running
    if (state.mainDockerContainer) {
      const containerInfo = await inspectContainer(state.mainDockerContainer);
      if (containerInfo) {
        state.mainPort = containerInfo.port;
        console.log(
          'Main docker container already running:',
          state.mainDockerContainer
        );
        return;
      }
      // Container doesn't exist, clear the reference
      state.mainDockerContainer = undefined;
    }

    // Start main docker container
    await startMainDockerContainer(state);
  } catch (error) {
    console.error('Error ensuring main docker is running:', error);
  }
}

/**
 * Starts the main Docker container
 * Updates state.mainDockerContainer
 */
export async function startMainDockerContainer(
  state: ExtensionState
): Promise<void> {
  const projectName = state.config?.name;
  const dockerImageName = getDockerImageName(projectName);
  const containerName = getMainContainerName(projectName);

  try {
    await ensureLarryDockerImage(projectName);

    const foundryProjectRoot = await findProjectRoot();
    if (!foundryProjectRoot) {
      throw new Error('Project root not found.');
    }

    // Clean up existing container if any
    try {
      await execAsync(`docker rm -f ${containerName}`);
      console.log(`Cleaned up existing main container: ${containerName}`);
    } catch (cleanupError) {
      // Container doesn't exist, which is fine
    }

    // Find available port starting from default
    const port = await findAvailablePort(state.mainPort);
    console.log(`Starting main container on port ${port}`);

    // Start main container
    const { stdout } = await execAsync(
      `docker run -d --name ${containerName} \
 -p ${port}:${port} \
 -e PORT=${port} \
 -e WORKSPACE_ROOT=/workspace \
 -v "${foundryProjectRoot}:/workspace:ro" \
 --user 1001:1001 \
 ${dockerImageName}`
    );

    const containerId = stdout.trim();
    state.mainDockerContainer = containerId;
    state.mainPort = port;

    console.log('Main Larry container started:', containerId);
  } catch (error) {
    console.error('Error starting main Larry container:', error);
    throw error;
  }
}

/**
 * Stops the main Docker container
 */
export async function stopMainDockerContainer(
  state: ExtensionState
): Promise<void> {
  const projectName = state.config?.name;
  const containerName = getMainContainerName(projectName);

  try {
    if (!state.mainDockerContainer) {
      return;
    }

    // Stop and remove container
    await execAsync(`docker stop ${containerName}`);
    await execAsync(`docker rm ${containerName}`);

    state.mainDockerContainer = undefined;
    console.log('Main Larry container stopped');
  } catch (error) {
    console.error('Error stopping main Larry container:', error);
  }
}

// ============================================================================
// Worktree Container Management
// ============================================================================

/**
 * Starts a Docker container for a worktree
 * Updates state.runningContainers and state.worktreePort
 *
 * @returns Container ID
 */
export async function startWorktreeDockerContainer(
  state: ExtensionState,
  worktreeName: string,
  worktreePath: string,
  threadId: string | undefined
): Promise<string> {
  const projectName = state.config?.name;
  const dockerImageName = getDockerImageName(projectName);
  const containerName = getWorktreeContainerName(projectName, worktreeName);

  try {
    // Ensure Docker image exists before running
    await ensureLarryDockerImage(projectName);

    // Clean up existing container if any
    try {
      await execAsync(`docker rm -f ${containerName}`);
      console.log(`Cleaned up existing worktree container: ${containerName}`);
    } catch (cleanupError) {
      // Container doesn't exist, which is fine
    }

    // Find available port starting from default
    const port = await findAvailablePort(state.worktreePort);
    console.log(`Starting worktree container on port ${port}`);

    // Start worktree container
    const threadIdEnv = threadId ? `-e THREAD_ID=${threadId}` : '';
    const { stdout } = await execAsync(
      `docker run -d --name ${containerName} \
 -p ${port}:${port} \
 -e PORT=${port} \
 ${threadIdEnv} \
 -e WORKTREE_NAME=${worktreeName} \
 -e WORKSPACE_ROOT=/workspace \
 -v "${worktreePath}:/workspace:rw" \
 --user 1001:1001 \
 ${dockerImageName}`
    );

    const containerId = stdout.trim();
    state.runningContainers.set(worktreeName, containerId);
    state.worktreePort = port;

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

/**
 * Stops a worktree Docker container
 */
export async function stopWorktreeDockerContainer(
  state: ExtensionState,
  worktreeName: string
): Promise<void> {
  const projectName = state.config?.name;
  const containerName = getWorktreeContainerName(projectName, worktreeName);

  try {
    await execAsync(`docker stop ${containerName}`);
    state.runningContainers.delete(worktreeName);
    console.log(`Worktree container stopped: ${containerName}`);
  } catch (error) {
    console.error('Error stopping worktree container:', error);
    throw error;
  }
}

/**
 * Removes a worktree Docker container (force)
 */
export async function removeWorktreeDockerContainer(
  projectName: string | undefined,
  worktreeName: string
): Promise<void> {
  const containerName = getWorktreeContainerName(projectName, worktreeName);

  try {
    await execAsync(`docker stop ${containerName}`);
  } catch (e) {
    // Container might not be running
  }
  try {
    await execAsync(`docker rm -f ${containerName}`);
  } catch (e) {
    // Container might not exist
  }
}

/**
 * Gets the status of a worktree container
 */
export async function getWorktreeContainerStatus(
  projectName: string | undefined,
  worktreeName: string
): Promise<{
  isRunning: boolean;
  containerId: string | undefined;
  port: number;
}> {
  const containerName = getWorktreeContainerName(projectName, worktreeName);
  const containerInfo = await inspectContainer(containerName);

  if (containerInfo) {
    return {
      isRunning: containerInfo.isRunning,
      containerId: containerInfo.id,
      port: containerInfo.port,
    };
  }

  return {
    isRunning: false,
    containerId: undefined,
    port: 4220,
  };
}

/**
 * Starts an existing stopped container
 */
export async function startExistingContainer(
  containerId: string
): Promise<void> {
  await execAsync(`docker start ${containerId}`);
}
