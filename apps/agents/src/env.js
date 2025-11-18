const { createEnv } = require('@t3-oss/env-nextjs');
const { z } = require('zod');

const env = createEnv({
  /*
   * Server-only Environment variables
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
  },

  /*
   * Client-Exposed Environment variables, available on the client & server.
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
   * Specify client and server side variables
   */
  runtimeEnv: {
    // server side variables
    FOUNDRY_TOKEN: process.env.FOUNDRY_TOKEN,
    FOUNDRY_TEST_USER: process.env.FOUNDRY_TEST_USER,
    OSDK_CLIENT_SECRET: process.env.OSDK_CLIENT_SECRET,
    OPEN_WEATHER_API_KEY: process.env.OPEN_WEATHER_API_KEY,
    LOG_PREFIX: process.env.LOG_PREFIX,
    ONTOLOGY_ID: process.env.ONTOLOGY_ID,
    GOOGLE_SEARCH_API_KEY: process.env.GOOGLE_SEARCH_API_KEY,
    GOOGLE_SEARCH_ENGINE_ID: process.env.GOOGLE_SEARCH_ENGINE_ID,
    GOOGLE_SEARCH_ENGINE_MARKETS: process.env.GOOGLE_SEARCH_ENGINE_MARKETS,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    BROWSERFY_KEY: process.env.BROWSERFY_KEY,
    BROWSERFY_BROWSER_URL: process.env.BROWSERFY_BROWSER_URL,
    RANGR_OSDK_CLIENT_ID: process.env.RANGR_OSDK_CLIENT_ID,
    RANGR_OSDK_CLIENT_SECRET: process.env.RANGR_OSDK_CLIENT_SECRET,
    RANGR_FOUNDRY_STACK_URL: process.env.RANGR_FOUNDRY_STACK_URL,
    RANGR_ONTOLOGY_RID: process.env.RANGR_ONTOLOGY_RID,
    OFFICE_SERVICE_ACCOUNT: process.env.OFFICE_SERVICE_ACCOUNT,
    OPEN_AI_KEY: process.env.OPEN_AI_KEY,
    SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
    SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN,
    SLACK_BASE_URL: process.env.SLACK_BASE_URL,
    GSUITE_SERVICE_ACCOUNT: process.env.GSUITE_SERVICE_ACCOUNT,
    EIA_API_KEY: process.env.EIA_API_KEY,
    EIA_BASE_URL: process.env.EIA_BASE_URL,
    CA_SERIES_ID: process.env.CA_SERIES_ID,
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
    GITHUB_PRIVATE_KEY: process.env.GITHUB_PRIVATE_KEY,
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
    GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
    GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER,
    GITHUB_REPO_NAME: process.env.GITHUB_REPO_NAME,

    FOUNDRY_STACK_URL: process.env.FOUNDRY_STACK_URL,
    OSDK_CLIENT_ID: process.env.OSDK_CLIENT_ID,
    REDIRECT_URL: process.env.REDIRECT_URL,
    ONTOLOGY_RID: process.env.ONTOLOGY_RID,

    // client side variables
    NEXT_PUBLIC_FOUNDRY_STACK_URL: process.env.NEXT_PUBLIC_FOUNDRY_STACK_URL,
    NEXT_PUBLIC_OSDK_CLIENT_ID: process.env.NEXT_PUBLIC_OSDK_CLIENT_ID,
    NEXT_PUBLIC_REDIRECT_URL: process.env.NEXT_PUBLIC_REDIRECT_URL,
    NEXT_PUBLIC_ONTOLOGY_RID: process.env.NEXT_PUBLIC_ONTOLOGY_RID,
  },

  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});

module.exports = { env };
