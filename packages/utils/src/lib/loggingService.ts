// perExecBytes defaults to 256 KB
// globalBytes defaults to 64 MB
export function createLoggingService(
  perExecBytes = 256 * 1024,
  globalBytes = 64 * 1024 * 1024,
  now: () => number = Date.now, // injectable clock for deterministic tests
) {
  type Buf = { entries: string[]; byteSize: number; lastAccess: number };

  const buffers = new Map<string, Buf>();
  let totalBytes = 0;

  // --- O(log n) LRU heap (lazy-delete) ---
  const lruHeap: Array<{ ts: number; id: string }> = [];

  const heapPush = (item: { ts: number; id: string }) => {
    lruHeap.push(item);
    let i = lruHeap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1; // parent index
      if (lruHeap[p].ts <= lruHeap[i].ts) break;
      [lruHeap[p], lruHeap[i]] = [lruHeap[i], lruHeap[p]];
      i = p;
    }
  };

  const heapPop = (): { ts: number; id: string } | undefined => {
    if (lruHeap.length === 0) return undefined;
    const top = lruHeap[0];
    const last = lruHeap.pop()!;
    if (lruHeap.length > 0) {
      lruHeap[0] = last;
      // siftDown
      let i = 0;
      while (true) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let m = i;
        if (l < lruHeap.length && lruHeap[l].ts < lruHeap[m].ts) m = l;
        if (r < lruHeap.length && lruHeap[r].ts < lruHeap[m].ts) m = r;
        if (m === i) break;
        [lruHeap[i], lruHeap[m]] = [lruHeap[m], lruHeap[i]];
        i = m;
      }
    }
    return top;
  };

  const approxBytes = (msg: string) => Buffer.byteLength(msg, 'utf8') + 1;

  function ensureBuffer(executionId: string) {
    if (!buffers.has(executionId)) {
      buffers.set(executionId, { entries: [], byteSize: 0, lastAccess: now() });
      heapPush({ ts: buffers.get(executionId)!.lastAccess, id: executionId });
    }
    return buffers.get(executionId)!;
  }

  function __debug() {
    return {
      executionIds: Array.from(buffers.keys()),
      totalBytes,
      bufferBytes: (id: string) => buffers.get(id)?.byteSize ?? 0,
    };
  }

  function evictGlobally(extraBytes = 0) {
    // Evict until (totalBytes + what-we-want-to-add) fits under globalBytes
    while (totalBytes + extraBytes > globalBytes && buffers.size > 0) {
      const top = heapPop();
      if (!top) break;

      const buf = buffers.get(top.id);
      // lazy delete: skip if heap entry is stale
      if (!buf || buf.lastAccess !== top.ts) continue;

      totalBytes -= buf.byteSize;
      buffers.delete(top.id);
    }
  }

  function assertInvariants() {
    if (process.env['NODE_ENV'] === 'production') return;
    let sum = 0;
    for (const [, b] of buffers) {
      const recomputed = b.entries.reduce((acc, m) => acc + approxBytes(m), 0);
      if (recomputed !== b.byteSize) {
        throw new Error(`Invariant violated: buffer.byteSize mismatch`);
      }
      sum += b.byteSize;
    }
    if (sum !== totalBytes) {
      throw new Error(`Invariant violated: totalBytes mismatch`);
    }
  }

  function log(executionId: string, message: string) {
    let buf = ensureBuffer(executionId);
    const size = approxBytes(message);

    const willExceedGlobal = totalBytes + size > globalBytes;

    // PRE-eviction
    evictGlobally(size);

    // If our own buffer was evicted while making room, recreate it.
    if (!buffers.has(executionId)) {
      buf = ensureBuffer(executionId);
    }

    // Still cannot fit? Drop the message.
    if (totalBytes + size > globalBytes) {
      assertInvariants();
      return;
    }

    // Write
    totalBytes += size;
    buf.byteSize += size;
    buf.entries.push(message);
    buf.lastAccess = now();
    heapPush({ ts: buf.lastAccess, id: executionId });

    // Per-exec trimming (keep newest single entry if needed)
    while (buf.byteSize > perExecBytes && buf.entries.length > 1) {
      const removed = buf.entries.shift()!;
      const removedSize = approxBytes(removed);
      buf.byteSize -= removedSize;
      totalBytes -= removedSize;
    }

    // If no global pressure and single entry is still oversized, drop it
    if (
      !willExceedGlobal &&
      buf.entries.length === 1 &&
      buf.byteSize > perExecBytes
    ) {
      const removed = buf.entries.pop()!;
      const removedSize = approxBytes(removed);
      buf.byteSize -= removedSize;
      totalBytes -= removedSize;
    }

    assertInvariants();
  }

  function getLog(executionId: string) {
    const buf = buffers.get(executionId);
    return buf ? buf.entries.join('\n') : '';
  }

  return { log, getLog, __debug };
}
