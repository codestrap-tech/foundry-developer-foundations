import type { TelemetryPayload } from '../../src/Tracing';
import { parentTelemetryPayload } from './parentTelemetryPayload';

export const childTelemetryPayload: TelemetryPayload = {
  resource: parentTelemetryPayload.resource,
  spans: [
    {
      trace_id: parentTelemetryPayload.spans[0].trace_id,
      span_id: 'cccccccccccccccc', // 16-hex chars
      parent_span_id: parentTelemetryPayload.spans[0].span_id,
      name: 'loadUser',
      start_time: '2025-05-11T00:00:00.000Z',
      end_time: '2025-05-11T00:00:00.500Z',
      traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-cccccccccccccccc-01',
      trace_flags: 1,
      kind: 'Internal',
      status_code: 'OK',
      status_message: undefined,
      error_code: undefined,
      sampling_decision: 'RECORD_AND_SAMPLE',
      sampling_rate: undefined,
      attributes: undefined,
    },
  ],
  events: [],
  links: [],
};
