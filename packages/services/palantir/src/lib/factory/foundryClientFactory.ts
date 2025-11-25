import type { FoundryClient} from '@codestrap/developer-foundations-types';
import { SupportedFoundryClients } from '@codestrap/developer-foundations-types';
import { curry } from 'ramda';
import { getFoundryClient as getFoundryClientPrivate } from '../foundryClient';
import { getFoundryClient as getFoundryClientPublic } from '../foundryClientPublic';

// in your factor injection factory
const factory = curry((
    map: Record<SupportedFoundryClients, (config?: Record<string, any>) => FoundryClient>,
    key: SupportedFoundryClients,
    config?: Record<string, any>
) => {
    const supportedKeys = Object.keys(SupportedFoundryClients).map((item) =>
        item.toLowerCase()
    );

    if (!supportedKeys.includes(key)) {
        throw new Error('unsupported key ${key}');
    }

    return map[key](config);
});

const clients = {
    public: (config?: Record<string, any>) => {
        if (config) {
            console.log(`config for getFoundryClientPublic is: ${config}`);
        }
        return getFoundryClientPublic();
    },
    private: (config?: Record<string, any>) => {
        if (config) {
            console.log(`config for getFoundryClientPrivate is: ${config}`);
        }
        return getFoundryClientPrivate();
    }
}

export const foundryClientFactory = factory(clients) as (key: SupportedFoundryClients, config?: Record<string, any>) => FoundryClient;
