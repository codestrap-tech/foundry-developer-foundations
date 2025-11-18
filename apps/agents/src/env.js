import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  /*
   * Server-side Environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {
    FOUNDRY_STACK_URL: z.url(),
    FOUNDRY_TOKEN: z.jwt({ alg: 'ES256' }),
    FOUNDRY_TEST_USER: z.uuid(),
    OSDK_CLIENT_SECRET: z.string(),
    OSDK_CLIENT_ID: z.string(),
    OPEN_WEATHER_API_KEY: z.string(),
    LOG_PREFIX: z.string(),
    ONTOLOGY_RID: z.string(),
    ONTOLOGY_ID: z.string(),
    GOOGLE_SEARCH_API_KEY: z.string(),
    GOOGLE_SEARCH_ENGINE_ID: z.string(),
    GOOGLE_SEARCH_ENGINE_MARKETS: z.string(),
    GEMINI_API_KEY: z.string(),
    BROWSERFY_KEY: z.string(),
    BROWSERFY_BROWSER_URL: z.url(),
    RANGR_OSDK_CLIENT_ID: z.string(),
    RANGR_OSDK_CLIENT_SECRET: z.string(),
    RANGR_FOUNDRY_STACK_URL: z.url(),
    RANGR_ONTOLOGY_RID: z.string(),
    OFFICE_SERVICE_ACCOUNT: z.email(),
    OPEN_AI_KEY: z.string(),
    SLACK_CLIENT_ID: z.string(),
    SLACK_CLIENT_SECRET: z.string(),
    SLACK_SIGNING_SECRET: z.string(),
    SLACK_BOT_TOKEN: z.string(),
    SLACK_APP_TOKEN: z.string(),
    SLACK_BASE_URL: z.url(),
    GSUITE_SERVICE_ACCOUNT: z.string(),
    EIA_API_KEY: z.string(),
    EIA_BASE_URL: z.url(),
    CA_SERIES_ID: z.string(),
    FIRECRAWL_API_KEY: z.string(),
    GITHUB_PRIVATE_KEY: z.string(),
    GITHUB_APP_ID: z.string(),
    GITHUB_APP_CLIENT_ID: z.string(),
    GITHUB_APP_CLIENT_SECRET: z.string(),
    GITHUB_REPO_OWNER: z.string(),
    GITHUB_REPO_NAME: z.string(),
  },

  /*
   * Client-Exposed Environment variables, available on the client & server.
   *
   * 💡 You'll get type errors if these are not prefixed with NEXT_PUBLIC_.
   */
  client: {},

  /*
   * Specify client-side variables
   */
  experimental__runtimeEnv: {},

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
