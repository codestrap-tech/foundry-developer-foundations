import { curry } from "ramda";
import { SupportedCodingAgents, LarryAgentFactoryType, SupportedEngines, LarryAgent } from "@codestrap/developer-foundations-types";

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

const clients: Record<SupportedCodingAgents, LarryAgentFactoryType> = {
    [SupportedCodingAgents.GOOGLE]: (config: Record<string, any>) => {
        return {
            name: 'cli-tool',
            readmePath: '../../packages/services/google/src/lib/README.LLM.md',
            xreason: SupportedEngines.GOOGLE_SERVICES_CODE_ASSIST,
        };
    }
}



  export default factory(clients) as (key: SupportedCodingAgents) => LarryAgent;