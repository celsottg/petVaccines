import { createSerialRunner } from './serialRunner';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const flush = () => new Promise<void>((r) => setImmediate(r));

describe('createSerialRunner', () => {
  it('runs the task once per request when requests do not overlap', async () => {
    const task = jest.fn().mockResolvedValue(undefined);
    const request = createSerialRunner(task);

    await request();
    await request();

    expect(task).toHaveBeenCalledTimes(2);
  });

  it('never starts a second run while one is in flight, and runs once more afterwards for any number of requests', async () => {
    const gates = [deferred(), deferred(), deferred()];
    const events: string[] = [];
    let call = 0;
    const task = jest.fn(async () => {
      const n = call++;
      events.push(`start ${n}`);
      await gates[n].promise;
      events.push(`end ${n}`);
    });
    const request = createSerialRunner(task);

    const first = request();
    await flush();
    const second = request();
    const third = request();
    const fourth = request();
    await flush();
    expect(events).toEqual(['start 0']);

    gates[0].resolve();
    await flush();
    expect(events).toEqual(['start 0', 'end 0', 'start 1']);

    gates[1].resolve();
    await Promise.all([first, second, third, fourth]);
    expect(events).toEqual(['start 0', 'end 0', 'start 1', 'end 1']);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('keeps going after a task that rejects or throws', async () => {
    const task = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementationOnce(() => {
        throw new Error('sync boom');
      })
      .mockResolvedValue(undefined);
    const request = createSerialRunner(task);

    await expect(request()).resolves.toBeUndefined();
    await expect(request()).resolves.toBeUndefined();
    await request();

    expect(task).toHaveBeenCalledTimes(3);
  });
});
