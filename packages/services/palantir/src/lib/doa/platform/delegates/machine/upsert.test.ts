/**
 * @jest-environment node
 */

import { upsertMachineExecution } from './upsert';

const mockFetch = jest.fn();

(global as any).fetch = mockFetch;

describe('upsertMachineExecution queueing', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  function mockUpsertResponse(machineId: string) {
    return {
      ok: true,
      json: async () => ({
        edits: {
          edits: [{ primaryKey: machineId }],
        },
      }),
    };
  }

  function mockGetResponse(machineId: string) {
    return {
      ok: true,
      json: async () => ({ id: machineId, state: 'some-state' }),
    };
  }

  it('performs a single network call and returns the machine', async () => {
    mockFetch
      .mockResolvedValueOnce(mockUpsertResponse('abc123')) // first POST
      .mockResolvedValueOnce(mockGetResponse('abc123')); // follow-up GET

    const result = await upsertMachineExecution(
      'abc123',
      'machine',
      'state',
      'logs',
      'token',
      'ontologyRid',
      'http://example',
    );

    expect(result).toEqual({ id: 'abc123', state: 'some-state' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain(
      '/actions/upsert-machine/apply',
    );
    expect(mockFetch.mock.calls[1][0]).toContain('/MachineExecutions/abc123');
  });

  it('serializes concurrent calls (last-write-wins)', async () => {
    // simulate delayed resolution of first call
    let resolveFirst!: (val: any) => void;
    const firstPostPromise = new Promise<any>((res) => (resolveFirst = res));
    mockFetch
      .mockReturnValueOnce(firstPostPromise) // first POST (pending)
      .mockResolvedValueOnce(mockGetResponse('id1')) // first GET
      .mockResolvedValueOnce(mockUpsertResponse('id2')) // second POST
      .mockResolvedValueOnce(mockGetResponse('id2')); // second GET

    const p1 = upsertMachineExecution(
      'same',
      'machine',
      'state1',
      'logs1',
      'token',
      'ontology',
      'http://example',
    );
    const p2 = upsertMachineExecution(
      'same',
      'machine',
      'state2',
      'logs2',
      'token',
      'ontology',
      'http://example',
    );

    // Resolve the first POST late
    resolveFirst(mockUpsertResponse('id1'));

    const [r1, r2] = await Promise.all([p1, p2]);

    // Both should get the final machine result (id2)
    expect(r1).toEqual({ id: 'id2', state: 'some-state' });
    expect(r2).toEqual({ id: 'id2', state: 'some-state' });
  });

  it('rejects waiters if POST fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Error',
    });

    await expect(
      upsertMachineExecution(
        'fail',
        'machine',
        'state',
        'logs',
        'token',
        'ontologyRid',
        'http://example',
      ),
    ).rejects.toThrow(/Upsert failed: 500/);
  });

  it('rejects if GET fails', async () => {
    mockFetch
      .mockResolvedValueOnce(mockUpsertResponse('bad123'))
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

    await expect(
      upsertMachineExecution(
        'bad123',
        'machine',
        'state',
        'logs',
        'token',
        'ontologyRid',
        'http://example',
      ),
    ).rejects.toThrow(/Fetch machine failed: 404/);
  });
});
