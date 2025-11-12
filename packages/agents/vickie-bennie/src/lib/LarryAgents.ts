import { SupportedEngines } from '@codestrap/developer-foundations-x-reason';

export type LarryAgentConfig = Record<SupportedCodingAgents, {
    name: string;
    readmePath: string;
    xreason: SupportedEngines;
}>

export enum SupportedCodingAgents {
    GOOGLE = 'google',
}

export const larryAgents: LarryAgentConfig = {
    [SupportedCodingAgents.GOOGLE]: {
        name: 'cli-tool',
        readmePath: '../../packages/services/google/src/lib/README.LLM.md',
        xreason: SupportedEngines.GOOGLE_SERVICES_CODE_ASSIST,
    },
};