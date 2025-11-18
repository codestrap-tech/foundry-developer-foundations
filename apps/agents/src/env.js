const { createEnv } = require('@t3-oss/env-nextjs');
const { z } = require('zod');

const env = createEnv({
  /*
   * Server-only Environment variables schema
   */
  server: {
    FOUNDRY_TOKEN: z.string(), // in Zod@4 z.jwt({ alg: 'ES256' }),
    FOUNDRY_TEST_USER: z.string().uuid(),
    OSDK_CLIENT_SECRET: z.string(),
    OPEN_WEATHER_API_KEY: z.string(),
    LOG_PREFIX: z.string(),
    ONTOLOGY_ID: z.string(),
    GOOGLE_SEARCH_API_KEY: z.string(),
    GOOGLE_SEARCH_ENGINE_ID: z.string(),
    GOOGLE_SEARCH_ENGINE_MARKETS: z.string(),
    GEMINI_API_KEY: z.string(),
    BROWSERFY_KEY: z.string(),
    BROWSERFY_BROWSER_URL: z.string().url(),
    RANGR_OSDK_CLIENT_ID: z.string(),
    RANGR_OSDK_CLIENT_SECRET: z.string(),
    RANGR_FOUNDRY_STACK_URL: z.string().url(),
    RANGR_ONTOLOGY_RID: z.string(),
    OFFICE_SERVICE_ACCOUNT: z.string().email(),
    OPEN_AI_KEY: z.string(),
    SLACK_CLIENT_ID: z.string(),
    SLACK_CLIENT_SECRET: z.string(),
    SLACK_SIGNING_SECRET: z.string(),
    SLACK_BOT_TOKEN: z.string(),
    SLACK_APP_TOKEN: z.string(),
    SLACK_BASE_URL: z.string().url(),
    GSUITE_SERVICE_ACCOUNT: z.string(),
    EIA_API_KEY: z.string(),
    EIA_BASE_URL: z.string().url(),
    CA_SERIES_ID: z.string(),
    FIRECRAWL_API_KEY: z.string(),
    GITHUB_PRIVATE_KEY: z.string(),
    GITHUB_APP_ID: z.string(),
    GITHUB_APP_CLIENT_ID: z.string(),
    GITHUB_APP_CLIENT_SECRET: z.string(),
    GITHUB_REPO_OWNER: z.string(),
    GITHUB_REPO_NAME: z.string(),

    FOUNDRY_STACK_URL: z.string().url(),
    OSDK_CLIENT_ID: z.string(),
    REDIRECT_URL: z.string().url(),
    ONTOLOGY_RID: z.string(),

    REPO_ROOT: z.string(),
  },

  /*
   * Client-Exposed Environment variables schema, available on the client & server.
   *
   * 💡 You'll get type errors if these are not prefixed with NEXT_PUBLIC_.
   */
  client: {
    NEXT_PUBLIC_FOUNDRY_STACK_URL: z.string().url(),
    NEXT_PUBLIC_OSDK_CLIENT_ID: z.string(),
    NEXT_PUBLIC_REDIRECT_URL: z.string().url(),
    NEXT_PUBLIC_ONTOLOGY_RID: z.string(),
  },

  /*
   * Runtime (client-side) Environment variables
   */
  experimental__runtimeEnv: {
    NEXT_PUBLIC_FOUNDRY_STACK_URL: process.env.NEXT_PUBLIC_FOUNDRY_STACK_URL,
    NEXT_PUBLIC_OSDK_CLIENT_ID: process.env.NEXT_PUBLIC_OSDK_CLIENT_ID,
    NEXT_PUBLIC_REDIRECT_URL: process.env.NEXT_PUBLIC_REDIRECT_URL,
    NEXT_PUBLIC_ONTOLOGY_RID: process.env.NEXT_PUBLIC_ONTOLOGY_RID,
  },

  /**
   * Run `build` or `serve` with `SKIP_ENV_VALIDATION` to skip env validation.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});

module.exports = { env };
