/**
 * Wraps an async task so runs never overlap. A request that arrives while the
 * task is running is not lost: the task runs once more after it, however many
 * requests came in meanwhile, so the last state always wins. The returned
 * function resolves when everything requested so far is done and never rejects.
 */
export function createSerialRunner(task: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let again = false;

  return function request() {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      // Yield first so `running` is assigned before anything below can clear it, even for a task that fails synchronously.
      await null;
      try {
        do {
          again = false;
          try {
            await task();
          } catch {
            // The task reports its own problems; a failed run must not stop the next one.
          }
        } while (again);
      } finally {
        running = null;
      }
    })();
    return running;
  };
}
