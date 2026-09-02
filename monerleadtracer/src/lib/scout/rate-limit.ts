/**
 * Prosta kolejka z odstępem czasowym.
 *
 * Google Places nie lubi serii równoległych zapytań, a my i tak chodzimy
 * sekwencyjnie (jeden krok skanu = kilka zapytań). Zamiast token bucketa
 * wystarczy łańcuch obietnic z minimalnym odstępem 1000/rps ms.
 */

export interface Limiter {
  run<T>(fn: () => Promise<T>): Promise<T>;
  /** Ile zadań czeka w kolejce (diagnostyka). */
  pending(): number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createLimiter(rps: number): Limiter {
  const interval = rps > 0 ? 1000 / rps : 0;
  let chain: Promise<unknown> = Promise.resolve();
  let lastStart = 0;
  let queued = 0;

  function run<T>(fn: () => Promise<T>): Promise<T> {
    queued += 1;
    const result = chain.then(async () => {
      const wait = lastStart + interval - Date.now();
      if (wait > 0) await sleep(wait);
      lastStart = Date.now();
      try {
        return await fn();
      } finally {
        queued -= 1;
      }
    });

    // Odrzucone zadanie nie może zerwać łańcucha — kolejne muszą się wykonać.
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return { run, pending: () => queued };
}
