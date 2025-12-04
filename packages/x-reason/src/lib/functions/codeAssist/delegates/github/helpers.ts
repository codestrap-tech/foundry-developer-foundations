import * as path from 'path';
import * as fs from 'fs';

import { container } from "@codestrap/developer-foundations-di";
import { TYPES, VersionControlService } from "@codestrap/developer-foundations-types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let githubService: VersionControlService | undefined;

async function getGithubClient(): Promise<VersionControlService> {
    if (!githubService) {
        githubService = await container.getAsync<VersionControlService>(TYPES.VersionControlService);
    }

    return githubService as VersionControlService;
}

function clearGithubServiceCache(): void {
    githubService = undefined;
}

/**
 * Retry wrapper that obtains a fresh GitHub service (with new token) on each retry.
 * This handles token expiration by refreshing the cached service on retry attempts.
 */
async function withGithubRetry<T>(
  fn: (service: VersionControlService) => Promise<T>,
  maxRetries = 2,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // On retry (attempt > 1), clear cache to get fresh token
      if (attempt > 1) {
        clearGithubServiceCache();
      }
      const service = await getGithubClient();
      return await fn(service);
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        console.log(`Attempt ${attempt} failed, refreshing token and retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
}

export async function writeFileIfNotFoundLocally(file: string | undefined) {
    if (file && !fs.existsSync(file)) {
        // try getting the file from version control
        // we do not throw if not found because the file will be created later
        const parts = file.split('/');
        const fileName = parts.pop() || '';
        let result;
    
        try {
          // this will throw "Path ${path} not found in repo ${owner}/${repo} or is not a file." if the file is not found
          result = await withGithubRetry((service) => service.getFile({
            owner: process.env.GITHUB_REPO_OWNER || '',
            repo: process.env.GITHUB_REPO_NAME || '',
            path: fileName,
          }));
        } catch (e) {
          // log the error just in case it is something other than file not found
          console.log(e);
        }
    
        if (result) {
          const fileContents = result.content.toString('utf8');
    
          // lets store this locally so we can read it and apply edits.
          const abs = path.resolve(process.env.BASE_FILE_STORAGE || process.cwd(), fileName);
          await fs.promises.writeFile(abs, fileContents, 'utf8');
        }
      }
}

export async function saveFileToGithub(file: string, content?: string) {
    // reload the file and save in case of changes
    if (!content) {
        content = await fs.promises.readFile(file, 'utf8');
    }
    const parts = file.split('/');
    const fileName = parts.pop() || '';
    let sha: string | undefined;

    try {
        // check if the file exists in github repo
        const result = await withGithubRetry((service) => service.getFile({
            owner: process.env.GITHUB_REPO_OWNER || '',
            repo: process.env.GITHUB_REPO_NAME || '',
            path: fileName,
        }));
        sha = result.sha;
    } catch (e) {
        // log the error just in case it is something other than file not found
        console.log(e);
    }
    // if sha is defined it will update, otherwise create
    await withGithubRetry((service) => service.checkinFile({
        owner: process.env.GITHUB_REPO_OWNER || '',
        repo: process.env.GITHUB_REPO_NAME || '',
        path: fileName,
        message: '[specReview] write proposed spec design.',
        content: content as string,
        sha,
    }));
}