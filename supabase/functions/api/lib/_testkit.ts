// Tiny assertion kit with no network imports, so the same tests run under
// `deno test` and under Node (scripts/run-api-tests.mjs shims Deno.test).
export function assert(cond: unknown, msg = 'assertion failed'): asserts cond {
  if (!cond) throw new Error(msg);
}

function eq(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => eq((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export function assertEquals(actual: unknown, expected: unknown, msg?: string): void {
  if (!eq(actual, expected)) {
    throw new Error(
      (msg ? msg + ': ' : '') + `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

export function test(name: string, fn: () => void | Promise<void>): void {
  Deno.test(name, fn);
}
