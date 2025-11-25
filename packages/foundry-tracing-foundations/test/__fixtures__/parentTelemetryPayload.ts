import type { TelemetryPayload } from '../../src/Tracing';

export const parentTelemetryPayload: TelemetryPayload = {
  resource: {
    resource_id: 'resource-1234-uuid',
    service_name: 'vickie',
    service_instance_id: 'production',
    telemetry_sdk_name: 'xreason-functions',
    telemetry_sdk_version: '6.1.1',
    host_hostname: 'codestrap.usw-3.palantirfoundry.com',
    host_architecture: 'prod',
  },
  spans: [
    {
      trace_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // 32-hex chars
      span_id: 'bbbbbbbbbbbbbbbb', // 16-hex chars
      name: 'vickieForAutomate',
      start_time: '2025-05-11T00:00:00.000Z',
      end_time: '2025-05-11T00:00:01.000Z',
      traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
      trace_flags: 1,
      kind: 'Server',
      status_code: 'OK',
      status_message: undefined,
      error_code: undefined,
      sampling_decision: 'RECORD_AND_SAMPLE',
      sampling_rate: 1.0,
      attributes: JSON.stringify({
        endpoint:
          '/api/v2/ontologies/${client.ontologyRid}/queries/vickieForAutomate/execute',
      }),
    },
  ],
  events: [],
  links: [],
};
