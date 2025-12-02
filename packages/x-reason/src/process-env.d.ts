import { SupportedFoundryClients } from "@codestrap/developer-foundations-types";

// process-env.d.ts
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            BASE_FILE_STORAGE: string;
            FOUNDRY_STACK_URL: string;
            FOUNDRY_TOKEN: string;
            FOUNDRY_TEST_USER: string;
            OSDK_CLIENT_ID: string;
            OSDK_CLIENT_SECRET: string;
            OPEN_WEATHER_API_KEY: string;
            LOG_PREFIX: string;
            ONTOLOGY_RID: string;
            ONTOLOGY_ID: string;
            GOOGLE_SEARCH_API_KEY: string;
            GOOGLE_SEARCH_ENGINE_ID: string;
            GOOGLE_SEARCH_ENGINE_MARKETS: string;
            GEMINI_API_KEY: string;
            BROWSERFY_KEY: string;
            BROWSERFY_BROWSER_URL: string;
            RANGR_OSDK_CLIENT_ID: string;
            RANGR_OSDK_CLIENT_SECRET: string;
            RANGR_FOUNDRY_STACK_URL: string;
            RANGR_ONTOLOGY_RID: string;
            OFFICE_SERVICE_ACCOUNT: string;
            OPEN_AI_KEY: string;
            SLACK_CLIENT_ID: string;
            SLACK_CLIENT_SECRET: string;
            SLACK_SIGNING_SECRET: string;
            SLACK_BOT_TOKEN: string;
            SLACK_APP_TOKEN: string;
            SLACK_BASE_URL: string;
            REDIRECT_URL: string;
            FOUNDRY_CLIENT_TYPE: SupportedFoundryClients;
            GITHUB_PRIVATE_KEY: string;
            GITHUB_APP_ID: string;
            GITHUB_APP_CLIENT_ID: string;
            GITHUB_APP_CLIENT_SECRET: string;
            GITHUB_INSTALLATION_ID: string;
            GITHUB_REPO_OWNER: string;
            GITHUB_REPO_NAME: string;
            WORKSPACE_ROOT: string;
        }
    }
}
export { };