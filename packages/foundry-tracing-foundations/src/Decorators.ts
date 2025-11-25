import { randomBytes } from 'crypto';
import type { ResourceModel, SpanModel, TelemetryPayload } from './Tracing';
import { collectTelemetryFetchWrapper } from './Tracing';
import { uuidv4 } from './utils/uuid';

// symbol key to store trace context on instance
const TRACE_CONTEXT = Symbol('TRACE_CONTEXT');

interface TraceContext {
  resource: ResourceModel;
  traceId: string;
  spanId: string;
}

export interface TraceOptions {
  resource: Omit<ResourceModel, 'resource_id'>;
  operationName: string;
  kind?: SpanModel['kind'];
  samplingDecision?: SpanModel['sampling_decision'];
  samplingRate?: number;
  attributes?: Record<string, any>;
}

function getRandomBytes(size: number): Buffer {
  try {
    return randomBytes(size);
  } catch (e) {
    console.log(e);
    const arr = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return Buffer.from(arr);
  }
}

/**
 * Root-level trace decorator: starts a new trace and calls collectTelemetry
 */
export function Trace(opts: TraceOptions) {
  return function (
    _target: any,
    _prop: string,
    descriptor: PropertyDescriptor,
  ) {
    const original = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      // generate identifiers
      // OTLP‑compliant trace_id (32 hex digits) and span_id (16 hex digits)
      const traceId = getRandomBytes(16).toString('hex'); // 32 hex chars
      const spanId = getRandomBytes(8).toString('hex'); // 16 hex chars
      const resource: ResourceModel = {
        resource_id: uuidv4(),
        ...opts.resource,
      };

      // attach context for child spans
      (this as any)[TRACE_CONTEXT] = {
        resource,
        traceId,
        spanId,
      } as TraceContext;

      const start = new Date().toISOString();
      let err: any;
      try {
        return await original.apply(this, args);
      } catch (e) {
        err = e;
        throw e;
      } finally {
        const end = new Date().toISOString();
        // build payload
        const payload: TelemetryPayload = {
          resource,
          spans: [
            {
              trace_id: traceId,
              span_id: spanId,
              name: opts.operationName,
              start_time: start,
              end_time: end,
              traceparent: `00-${traceId}-${spanId}-01`,
              trace_flags: 1 as any,
              kind: opts.kind ?? 'Internal',
              status_code: err ? 'ERROR' : 'OK',
              status_message: `ERROR: ${err?.message} STACK: ${err?.stack}`,
              error_code: err?.code,
              sampling_decision: opts.samplingDecision ?? 'RECORD_AND_SAMPLE',
              sampling_rate: opts.samplingRate as any,
              attributes: opts.attributes
                ? JSON.stringify(opts.attributes)
                : undefined,
            },
          ],
          events: [],
          links: [],
        };
        try {
          const telemtryPayload = JSON.stringify(payload);
          // fire and forget, we do not want to hold up execution for this!
          // One day we should support background processing and batching
          collectTelemetryFetchWrapper(telemtryPayload).catch((e) => {
            // Silently fail to prevent unhandled rejections
            // Added this catch as because of the fire and forget we had
            // side effect of server crashes when we had unhandled rejections
            console.error('Failed to collect telemetry:', e);
          });
        } catch (e) {
          console.log(e);
        }
      }
    };
  };
}

export interface ChildTraceOptions {
  operationName: string;
  kind?: SpanModel['kind'];
  attributes?: Record<string, any>;
}

/**
 * Child-level trace decorator: creates a nested span under current trace
 */
export function TraceSpan(opts: ChildTraceOptions) {
  return function (
    _target: any,
    _prop: string,
    descriptor: PropertyDescriptor,
  ) {
    const original = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const ctx: TraceContext | undefined = (this as any)[TRACE_CONTEXT];
      if (!ctx)
        throw new Error(
          '@TraceSpan requires a preceding @Trace on the instance',
        );
      //OTLP‑compliant trace_id (32 hex digits) and span_id (16 hex digits)
      const childSpanId = getRandomBytes(8).toString('hex'); // 16 hex chars
      const start = new Date().toISOString();
      let err: any;
      try {
        return await original.apply(this, args);
      } catch (e) {
        err = e;
        throw e;
      } finally {
        const end = new Date().toISOString();
        // reuse same resource and traceId
        const payload: TelemetryPayload = {
          resource: ctx.resource,
          spans: [
            {
              trace_id: ctx.traceId,
              span_id: childSpanId,
              parent_span_id: ctx.spanId,
              name: opts.operationName,
              start_time: start,
              end_time: end,
              traceparent: `00-${ctx.traceId}-${childSpanId}-01`,
              trace_flags: 1 as any,
              kind: opts.kind ?? 'Internal',
              status_code: err ? 'ERROR' : 'OK',
              status_message: err?.message,
              error_code: err?.code,
              sampling_decision: 'RECORD_AND_SAMPLE',
              sampling_rate: undefined as any,
              attributes: opts.attributes
                ? JSON.stringify(opts.attributes)
                : undefined,
            },
          ],
          events: [],
          links: [],
        };
        try {
          const result = await collectTelemetryFetchWrapper(
            JSON.stringify(payload),
          );
          console.log(`traced: ${result}`);
        } catch (e) {
          console.log(e);
        }
      }
    };
  };
}
