const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  transformIgnorePatterns: [
    '/node_modules/(?!(@octokit|universal-user-agent|universal-github-app-jwt|before-after-hook|@osdk|@faker-js)/)',
  ],
};
