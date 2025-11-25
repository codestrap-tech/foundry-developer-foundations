# Foundry Tracing Foundations

## Introduction

Foundry Tracing Foundations is a Foundry native implementation of open tracing. Tracing spans are stored in the ontology where Foundry native tooling is used to assemble reports and interactive applications to view application performance.

## Getting Started

1. First download and install the [Foundry Tracing Foundations](#) Marketplace application on your Foundry stack. We are working on mocks for Foundry but have not published them yet. Once the mocks are done you no longer will require a Foundry stack.
1. Run `npm install @codestrap/developer-foundations.foundry-tracing-foundations`
1. Create a `.env` file and set the following values

```
FOUNDRY_STACK_URL=<your stack url>
OSDK_CLIENT_SECRET=<your osdk client secret>
OSDK_CLIENT_ID=<your osdk client id>
OPEN_WEATHER_API_KEY=<an open wheahter API key https://home.openweathermap.org/>
LOG_PREFIX=foundry-developer-foundations
```

1. Implement the `@Trace` and `@TraceSpan` in class instance methods you want to record tracing segments on. Example below.

## Example usage

Usee the class decorators to setup traces. This will cause the main parent trace to be setup and attach all child spans to it. We'll be creating a functional version soon.

```typescript
import {
  Trace,
  TraceSpan,
} from '@codestrap/developer-foundations.foundry-tracing-foundations';

export class DecoratorTest {
  @Trace({
    resource: {
      service_name: 'vickie',
      service_instance_id: 'production',
      telemetry_sdk_name: 'xreason-functions',
      telemetry_sdk_version: '6.1.1',
      host_hostname: 'codestrap.usw-3.palantirfoundry.com',
      host_architecture: 'prod',
    },
    operationName: 'vickieForAutomate',
    kind: 'Server',
    samplingDecision: 'RECORD_AND_SAMPLE',
    samplingRate: 1.0,
    attributes: {
      endpoint:
        '/api/v2/ontologies/${client.ontologyRid}/queries/vickieForAutomate/execute',
    },
  })
  public async testDecorator(): Promise<string> {
    await this.childSegment();
    return 'segments traces';
  }

  @TraceSpan({ operationName: 'loadUser', kind: 'Internal' })
  public async childSegment(): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve('test');
      }, 500);
    });
  }
}
```
