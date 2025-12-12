# Logging Service – Developer README

**TL;DR**
In‑memory logger with **per‑execution ring buffers** and a **global LRU cap**.

- **Hard memory ceilings:** `perExecBytes`, `globalBytes`.
- **LRU eviction:** O(log n) min‑heap by last access.
- **Semantics:** keep newest entry on global pressure; drop oversized single entry when there’s no global pressure.
- **Great for:** request/job/agent runs; dump logs on error/completion.

---

## Install / Import

```ts
// ESM/TS
import { createLoggingService } from '@xreason/services/loggingService';
```

_No external deps._

---

## API

```ts
function createLoggingService(
  perExecBytes = 256 * 1024,
  globalBytes = 64 * 1024 * 1024,
  now: () => number = Date.now,
): {
  log: (executionId: string, message: string) => void;
  getLog: (executionId: string) => string; // joined by '\n'
  __debug: () => {
    executionIds: string[];
    totalBytes: number; // sum of all buffers
    bufferBytes: (id: string) => number; // 0 if missing
  };
};
```

### Methods

- `log(executionId, message)`
  - Appends `message` to that execution’s buffer.
  - Enforces caps:
    - **Pre‑eviction**: Evicts oldest executions until `totalBytes + size <= globalBytes`.
    - **Per‑exec**: Trims oldest entries of that execution until ≤ `perExecBytes` **but** keeps at least the newest entry if there was global pressure.
    - **Oversized single message**: If there was **no** global pressure and the single entry still exceeds `perExecBytes`, it is **dropped**.

- `getLog(executionId)`
  - Returns the execution’s entries joined by `'\n'`, or `''` if none.

- `__debug()`
  - For tests/telemetry. Do not rely on as a stable public API.

---

## Memory Accounting

- Size is `Buffer.byteLength(msg, 'utf8') + 1` (the `+1` is for the newline when joining).
- **Unicode safe**: multibyte chars are counted correctly via `Buffer.byteLength`.
- Node‑only note: if you must run in the browser, swap to `new TextEncoder().encode(msg).length`.

---

## Eviction Semantics (precise)

1. **Global LRU (O(log n))**
   - Min‑heap on `lastAccess`.
   - Evict **entire** oldest executions until `totalBytes + incomingSize <= globalBytes`.

2. **Per‑execution ring buffer**
   - While `byteSize > perExecBytes` and `entries.length > 1`, drop oldest entries.
   - If **no global pressure** and a single entry still exceeds `perExecBytes`, **drop it**.

3. **Edge caps**
   - `globalBytes = 0` → nothing is retained.
   - `perExecBytes = 0` → execution buffers retain nothing.

---

## Complexity

- `log()`:
  - Heap push/pop: **O(log n)** (n = active execution IDs).
  - Per‑exec trimming: proportional to removed entries (amortized OK under cap).

- `getLog()`:
  - Join of that buffer’s strings (O(bytes in that exec)).

---

## Usage Patterns

### Request/job/agent scoped logs

```ts
const logs = createLoggingService(64 * 1024, 64 * 1024 * 1024);
const id = ctx.requestId; // or jobId/execId

logs.log(id, 'starting step A');
// ...
logs.log(id, 'A done');
// on error or completion:
const text = logs.getLog(id);
// attach to response, persist selectively, or emit on error only
```

### Sidecar logger with your existing stack (pino/winston/etc.)

Keep your normal streaming logger; also `log()` to this service using a **correlation ID**. On failure, fetch `getLog(id)` and attach to error reports/UI.

---

## Testing & Determinism

- **Inject clock**: `createLoggingService(per, global, () => ++t)` for precise LRU order.
- **Invariants** (dev only): checks that `totalBytes === Σ buffer.byteSize` and each `buffer.byteSize` matches re‑computed entry sizes. Throws on mismatch.

---

## Guarantees & Caveats

- **Isolation**: per‑ID buffers are independent.
- **No I/O**: in‑memory only; add your own export/flush hook if needed.
- **Single‑threaded**: designed for JS event loop (no cross‑thread sync).
- **Join separator**: `'\n'`. If you need exact original bytes, store entries externally.

---

## Examples

**Basic**

```ts
const svc = createLoggingService(32 * 1024, 128 * 1024 * 1024);

svc.log('exec-1', 'step 1');
svc.log('exec-1', 'step 2');
console.log(svc.getLog('exec-1')); // "step 1\nstep 2"
```

**Oversized single message (no global pressure)**

```ts
const svc = createLoggingService(32, 4096);
svc.log('x', 'X'.repeat(100)); // dropped (too big, no global pressure)
console.log(svc.getLog('x')); // ""
```

**Global pressure keeps newest**

```ts
const svc = createLoggingService(64, 100);
svc.log('old', 'O'.repeat(30));
svc.log('old', 'O'.repeat(30));
svc.log('new', 'N'.repeat(80)); // evicts 'old', keeps 'new'
```

---

## Extension Ideas (if needed)

- Structured entries: `{ ts, level, fields, msg }`.
- Export hooks: on completion/error, flush a buffer to a sink.
- Metrics: counts of evictions, drops, bytes per exec.
- Severity‑aware eviction (prefer dropping low‑level logs first).

---

## FAQ

- **Why `+1` byte per entry?**
  To account for the newline during `join('\n')`. Keeps accounting exact vs `getLog()` output.

- **Why keep newest message under global pressure?**
  Latest state is often most valuable for debugging; older entries get trimmed first.

- **Why evict before writing?**
  Simpler invariants and avoids temporary over‑cap states; early‑return if it still can’t fit.

---

That’s it—bounded, per‑ID logs with deterministic eviction you can ship today.
