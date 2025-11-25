// process-env.d.ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      FOUNDRY_STACK_URL: string;
      FOUNDRY_TOKEN: string;
      OSDK_CLIENT_ID: string;
      OSDK_CLIENT_SECRET: string;
      OPEN_WEATHER_API_KEY: string;
      LOG_PREFIX: string;
      ONTOLOGY_RID: string;
    }
  }
}
export {};
