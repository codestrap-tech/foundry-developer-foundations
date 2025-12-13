const core = require('@actions/core');
const github = require('@actions/github');
const { getChangedPaths } = require('./getChangedPaths');

async function run() {
  try {
    const baseRef =
      core.getInput('base-ref') ||
      process.env.GITHUB_BASE_REF || // present on PR events
      github.context.payload?.repository?.default_branch ||
      'master';
    const affectedDirs = await getChangedPaths(baseRef);

    core.info('Affected directories: ' + affectedDirs.join(', '));
    core.setOutput('affected-dirs', affectedDirs.join(' '));
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
