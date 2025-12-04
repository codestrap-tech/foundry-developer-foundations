// process-env.d.ts
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            WORKSPACE_ROOT: string;
        }
    }
}
export { };