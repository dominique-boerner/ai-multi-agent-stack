/**
 * Halts async execution for the given number of milliseconds.
 * Primarily used by LLM providers for rate-limit backoff delays.
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));
