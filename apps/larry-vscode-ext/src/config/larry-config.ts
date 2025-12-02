import * as fs from 'fs';
import path from 'path';
import { findProjectRoot } from '../findProjectRoot';
import type { LarryConfig } from '../types';

// ============================================================================
// Config Loading
// ============================================================================

/**
 * Loads larry.config.json from the project root
 * 
 * @returns Promise<LarryConfig> - The parsed config
 * @throws Error if config not found or invalid
 */
export async function loadLarryConfig(): Promise<LarryConfig> {
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

/**
 * Gets the docker image name based on project name
 */
export function getDockerImageName(projectName: string | undefined): string {
  return projectName ? `${projectName}-larry-server` : 'larry-server';
}

/**
 * Gets the container name for a worktree
 */
export function getWorktreeContainerName(projectName: string | undefined, worktreeName: string): string {
  return `${projectName || 'larry'}-worktree-${worktreeName}`;
}

/**
 * Gets the container name for the main server
 */
export function getMainContainerName(projectName: string | undefined): string {
  return `${projectName || 'larry'}-main-server`;
}

