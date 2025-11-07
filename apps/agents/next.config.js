//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  env: {
    // those examples are added only to check if build passes on CI
    OSDK_CLIENT_ID: process.env.OSDK_CLIENT_ID || 'example',
    OSDK_CLIENT_SECRET: process.env.OSDK_CLIENT_SECRET || 'example',
  }
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
