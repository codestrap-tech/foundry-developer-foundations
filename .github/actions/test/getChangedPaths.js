const github = require('@actions/github');
const core = require('@actions/core');

async function getChangedPaths(baseRef = 'origin/master') {
  try {
    core.info(`executing getChangedPaths`);
    const token = core.getInput('token', { required: true });
    const octokit = github.getOctokit(token);
    const context = github.context;

    const { data: compare } = await octokit.rest.repos.compareCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      base: baseRef,
      head: context.sha,
    });

    const directories = new Set();

    compare.files.forEach((file) => {
      const dir = file.filename.split('/')[0];
      if (
        dir &&
        dir !== '.github' &&
        dir !== '.gitignore' &&
        dir !== 'README.md'
      ) {
        directories.add(dir);
      }
    });

    return Array.from(directories);
  } catch (error) {
    core.error(`Error getting changed paths: ${error.message}`);
    return [];
  }
}

module.exports = { getChangedPaths };
