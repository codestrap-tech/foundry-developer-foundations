// Payload interfaces
import { container } from '@codestrap/developer-foundations-di';
import { TelemetryDao, TYPES } from '@codestrap/developer-foundations-types';

export interface ResourceModel {
  resource_id: string;
  service_name: string;
  service_instance_id?: string;
  telemetry_sdk_name?: string;
  telemetry_sdk_version?: string;
  host_hostname?: string;
  host_architecture?: string;
  process_pid?: number;
}

export const SpanKind = {
  Client: 'Client',
  Server: 'Server',
  Internal: 'Internal',
  Producer: 'Producer',
  Consumer: 'Consumer',
} as const;

export const StatusCode = {
  UNSET: 'UNSET',
  OK: 'OK',
  ERROR: 'ERROR',
} as const;

export const SamplingDecision = {
  DROP: 'DROP',
  RECORD: 'RECORD',
  RECORD_AND_SAMPLE: 'RECORD_AND_SAMPLE',
} as const;

export interface SpanModel {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  name: string;
  start_time: string;
  end_time: string;
  traceparent: string;
  tracestate?: string;
  trace_flags: number;
  kind: string;
  status_code: string;
  status_message?: string;
  error_code?: string;
  sampling_decision: string;
  sampling_rate?: number;
  http_method?: string;
  http_status_code?: number;
  db_system?: string;
  db_statement?: string;
  messaging_system?: string;
  messaging_destination?: string;
  attributes?: string;
}

export interface EventModel {
  event_id?: string;
  span_id: string;
  name: string;
  timestamp: string;
  attributes?: string;
}

export interface LinkModel {
  link_id?: string;
  source_span_id: string;
  linked_trace_id: string;
  linked_span_id: string;
  attributes?: string;
}

export interface TelemetryPayload {
  resource: ResourceModel;
  spans: SpanModel[];
  events: EventModel[];
  links: LinkModel[];
}

export async function collectTelemetryFetchWrapper(
  inputJSON: string,
): Promise<string> {
  const collectTelemetry = container.get<TelemetryDao>(TYPES.TelemetryDao);
  const result = await collectTelemetry(inputJSON);

  return result;
}
