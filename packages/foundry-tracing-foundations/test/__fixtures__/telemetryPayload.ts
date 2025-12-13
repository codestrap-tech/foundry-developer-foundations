import { TelemetryPayload } from '../../src/Tracing';

export const mockPayload: TelemetryPayload = {
  resource: {
    resource_id: 'resource-1',
    service_name: 'test-service',
  },
  spans: [
    {
      trace_id: 'trace-1',
      span_id: 'span-1',
      name: 'test-span',
      start_time: '2023-05-01T00:00:00Z',
      end_time: '2023-05-01T00:00:01Z',
      traceparent: 'traceparent-1',
      trace_flags: 1,
      kind: 'Client',
      status_code: 'OK',
      sampling_decision: 'RECORD',
    },
  ],
  events: [
    {
      span_id: 'span-1',
      name: 'test-event',
      timestamp: '2023-05-01T00:00:00.500Z',
    },
  ],
  links: [
    {
      source_span_id: 'span-1',
      linked_trace_id: 'trace-2',
      linked_span_id: 'span-2',
    },
  ],
};
