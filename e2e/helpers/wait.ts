export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  label?: string;
}

export async function poll<T>(
  fn: () => Promise<T>,
  predicate: (result: T) => boolean,
  options: PollOptions = {}
): Promise<T> {
  const {
    intervalMs = 5_000,
    timeoutMs = 120_000,
    label = 'condition',
  } = options;

  const deadline = Date.now() + timeoutMs;
  let lastResult: T | undefined;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      lastResult = await fn();
      if (predicate(lastResult)) {
        return lastResult;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    await sleep(intervalMs);
  }

  const detail = lastError
    ? `Last error: ${lastError.message}`
    : `Last result: ${JSON.stringify(lastResult)}`;
  throw new Error(`Timed out waiting for ${label} after ${timeoutMs}ms. ${detail}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
