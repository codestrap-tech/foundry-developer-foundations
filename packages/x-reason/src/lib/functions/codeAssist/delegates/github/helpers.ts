import * as path from 'path';
import * as fs from 'fs';

import { container } from "@codestrap/developer-foundations-di";
import { TYPES, VersionControlService } from "@codestrap/developer-foundations-types";

let githubService: VersionControlService | undefined;

async function getGithubClint(): Promise<VersionControlService> {
    if (!githubService) {
        githubService = await container.getAsync<VersionControlService>(TYPES.VersionControlService);
    }

    return githubService as VersionControlService
}

export async function writeFileIfNotFoundLocally(file: string | undefined) {
    const githubService = await getGithubClint();
    if (file && !fs.existsSync(file)) {
        // try getting the file from version control
        // we do not throw if not found because the file will be created later
        const parts = file.split('/');
        const fileName = parts.pop() || '';
        let result;
    
        try {
          // this will throw "Path ${path} not found in repo ${owner}/${repo} or is not a file." if the file is not found
          result = await githubService.getFile({
            owner: process.env.GITHUB_REPO_OWNER,
            repo: process.env.GITHUB_REPO_NAME,
            path: fileName,
          });
        } catch (e) {
          // log the error just in case it is something other than file not found
          console.log(e);
        }
    
        if (result) {
          const fileContents = result.content.toString('utf8');
    
          // lets store this lcoally so we can read it and apply edits.
          const abs = path.resolve(process.env.BASE_FILE_STORAGE || process.cwd(), fileName);
          await fs.promises.writeFile(abs, fileContents, 'utf8');
        }
      }
}

export async function saveFileToGithub(file: string, content?: string) {
    const githubService = await getGithubClint();
    // reload the file and save in case of changes
    if (!content) {
        content = await fs.promises.readFile(file, 'utf8');
    }
    const parts = file.split('/');
    const fileName = parts.pop() || '';
    let sha;

    try {
        // check if the file exists in github repo
        const result = await githubService.getFile({
            owner: process.env.GITHUB_REPO_OWNER,
            repo: process.env.GITHUB_REPO_NAME,
            path: fileName,
        });
        sha = result.sha;
    } catch (e) {
        // log the error just in case it is something other than file not found
        console.log(e);
    }
    // if sha is defined it will update, otherwise create
    await githubService.checkinFile({
        owner: process.env.GITHUB_REPO_OWNER,
        repo: process.env.GITHUB_REPO_NAME,
        path: fileName,
        message: '[specReview] write proposed spec design.',
        content,
        sha,
    });
}