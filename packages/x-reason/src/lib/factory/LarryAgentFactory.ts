import { curry } from "ramda";
import { SupportedEngines } from "./XreasonFactory";

export enum SupportedCodingAgents {
    GOOGLE = 'google',
}

type LarryAgent = {
    name: string;
    readmePath: string;
    xreason: SupportedEngines;
}

export type LarryAgentFactory = (config: Record<string, any>) => LarryAgent;


const factory = curry((map, key, config) => {
    const supportedKeys = Object.keys(SupportedCodingAgents).map((item) =>
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      SupportedCodingAgents[item]
    );
  
    if (!supportedKeys.includes(key)) {
      throw new Error('unsupported key ${key}');
    }
  
    return map[key](config);
});

const clients: Record<SupportedCodingAgents, LarryAgentFactory> = {
    [SupportedCodingAgents.GOOGLE]: (config: Record<string, any>) => {
        return {
            name: 'cli-tool',
            readmePath: '../../packages/services/google/src/lib/README.LLM.md',
            xreason: SupportedEngines.GOOGLE_SERVICES_CODE_ASSIST,
        };
    }
}



  export default factory(clients) as (key: SupportedCodingAgents) => LarryAgent;