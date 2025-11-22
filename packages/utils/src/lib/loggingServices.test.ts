import { createLoggingService } from './loggingService';

describe('createLoggingService', () => {
  test('isolates logs by executionId', () => {
    const svc = createLoggingService(1024, 4096);
    svc.log('execA', 'A1');
    svc.log('execB', 'B1');
    svc.log('execA', 'A2');

    expect(svc.getLog('execA')).toBe('A1\nA2');
    expect(svc.getLog('execB')).toBe('B1');
    expect(svc.__debug().executionIds.sort()).toEqual(['execA', 'execB']);
  });

  test('per-execution ring buffer trims when exceeding perExecBytes', () => {
    const perExecBytes = 32;
    const svc = createLoggingService(perExecBytes, 4096);

    const id = 'exec-ring';
    const m1 = '1234567890'; // 10 bytes
    const m2 = 'abcdefghij'; // 10 bytes
    const m3 = 'KLMNOPQRST'; // 10 bytes

    svc.log(id, m1);
    svc.log(id, m2);
    svc.log(id, m3);

    const log = svc.getLog(id);
    expect(log).not.toContain(m1);
    expect(log).toContain(m2);
    expect(log).toContain(m3);

    const expectedSize =
      Buffer.byteLength(m2, 'utf8') + 1 + Buffer.byteLength(m3, 'utf8') + 1;
    expect(svc.__debug().bufferBytes(id)).toBe(expectedSize);
  });

  test('global LRU eviction removes oldest execution logs', () => {
    const perExecBytes = 64;
    const globalBytes = 100;
    const svc = createLoggingService(perExecBytes, globalBytes);

    const oldMsg = 'O'.repeat(30);
    svc.log('old', oldMsg);
    svc.log('old', oldMsg);

    const newMsg = 'N'.repeat(80);
    svc.log('new', newMsg);

    expect(svc.getLog('old')).toBe('');
    expect(svc.getLog('new')).toContain(newMsg);

    const expectedSize = Buffer.byteLength(newMsg, 'utf8') + 1;
    expect(svc.__debug().totalBytes).toBe(expectedSize);
  });

  test('oversized single message is trimmed (ignored)', () => {
    const perExecBytes = 32;
    const svc = createLoggingService(perExecBytes, 1024);

    const id = 'oversized';
    const bigMsg = 'X'.repeat(100);

    svc.log(id, bigMsg);
    // It should be trimmed down by ring buffer
    const log = svc.getLog(id);
    expect(log.length).toBeLessThanOrEqual(perExecBytes);
    expect(svc.__debug().bufferBytes(id)).toBeLessThanOrEqual(perExecBytes);
  });

  test('buffer sizes match the exact message sizes', () => {
    const svc = createLoggingService(128, 256);

    const msgA1 = 'AAA';
    const msgB1 = 'BBBBBB';
    const msgB2 = 'B2';

    svc.log('A', msgA1);
    svc.log('B', msgB1);
    svc.log('B', msgB2);

    const debug = svc.__debug();
    const aExpected = Buffer.byteLength(msgA1, 'utf8') + 1;
    const bExpected =
      Buffer.byteLength(msgB1, 'utf8') +
      1 +
      Buffer.byteLength(msgB2, 'utf8') +
      1;

    expect(debug.bufferBytes('A')).toBe(aExpected);
    expect(debug.bufferBytes('B')).toBe(bExpected);
    expect(debug.totalBytes).toBe(aExpected + bExpected);
  });

  // -----------------------------
  // New tests (your requested fixes)
  // -----------------------------

  test('deterministic LRU using injected clock', () => {
    let t = 0;
    const now = () => ++t;
    const svc = createLoggingService(64, 70, now); // 70 so only 'a' is evicted

    svc.log('a', 'AAAA'); // t=1
    svc.log('b', 'BBBB'); // t=2

    // Force eviction on next insert
    const big = 'X'.repeat(60);
    svc.log('c', big); // t=3, should evict 'a' (oldest)

    expect(svc.getLog('a')).toBe('');
    expect(svc.getLog('b')).toContain('BBBB');
    expect(svc.getLog('c')).toContain(big);
  });

  test('stress/fuzz: invariants always hold', () => {
    const now = (() => {
      let t = 0;
      return () => ++t;
    })();
    const svc = createLoggingService(256, 4 * 1024, now);

    const ids = Array.from({ length: 50 }, (_, i) => `id-${i}`);
    const rand = (n: number) => Math.floor(Math.random() * n);

    for (let i = 0; i < 2000; i++) {
      const id = ids[rand(ids.length)];
      const len = rand(200); // 0..199
      const msg = '😀'.repeat(len); // multibyte payload too
      svc.log(id, msg);
    }

    const dbg = svc.__debug();
    const sum = dbg.executionIds.reduce(
      (acc, id) => acc + dbg.bufferBytes(id),
      0,
    );
    expect(sum).toBe(dbg.totalBytes);
  });

  test('edge: perExecBytes = 0 drops everything for that exec', () => {
    const svc = createLoggingService(0, 1024);
    svc.log('x', 'hi');
    expect(svc.getLog('x')).toBe('');
    expect(svc.__debug().bufferBytes('x')).toBe(0);
  });

  test('edge: globalBytes = 0 evicts everything immediately', () => {
    const svc = createLoggingService(1024, 0);
    svc.log('x', 'hi');
    expect(svc.getLog('x')).toBe('');
    expect(svc.__debug().totalBytes).toBe(0);
  });

  test('edge: unicode/multibyte sizing', () => {
    const per = 32;
    const svc = createLoggingService(per, 4096);
    const msg = '😀😀😀'; // each is multi-byte in UTF-8
    svc.log('u', msg);
    const expected = Buffer.byteLength(msg, 'utf8') + 1;
    expect(svc.__debug().bufferBytes('u')).toBe(expected);
  });
});
