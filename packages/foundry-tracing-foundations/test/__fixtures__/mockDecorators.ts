import { Trace, TraceSpan } from '../../src/Decorators';

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
