import { LRUCache, type LRUCacheOptions } from "./lru.js";

export interface MemoizeOptions extends LRUCacheOptions {
  /**
   * Custom cache key function. Receives the same arguments as the memoized function.
   * Default: JSON.stringify(args) — works for primitives and plain objects.
   */
  cacheKey?: (...args: unknown[]) => string;
}

const defaultKey = (...args: unknown[]): string => JSON.stringify(args);

/**
 * Memoize a synchronous function with optional LRU eviction and TTL.
 *
 * @example
 * const fib = memoize((n: number): number => n <= 1 ? n : fib(n-1) + fib(n-2));
 * fib(40); // fast
 *
 * const expensiveFn = memoize(compute, { maxSize: 100, ttl: 5000 });
 */
export function memoize<T extends (...args: never[]) => unknown>(
  fn: T,
  options: MemoizeOptions = {}
): T & { cache: LRUCache<string, ReturnType<T>>; clear(): void } {
  const { cacheKey = defaultKey, ...cacheOpts } = options;
  const cache = new LRUCache<string, ReturnType<T>>(cacheOpts);

  const memoized = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    const key = cacheKey(...(args as unknown[]));
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    // also handle explicit undefined returns — check has() after get()
    if (cache.has(key)) return cached as ReturnType<T>;
    const result = fn.apply(this, args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  } as T & { cache: LRUCache<string, ReturnType<T>>; clear(): void };

  memoized.cache = cache;
  memoized.clear = () => cache.clear();
  return memoized;
}

/**
 * Memoize an async function with optional LRU eviction and TTL.
 * Concurrent calls with the same key share a single in-flight promise —
 * the underlying function is called exactly once per key per cache miss.
 *
 * @example
 * const fetchUser = memoizeAsync(async (id: string) => api.getUser(id), { ttl: 30_000 });
 * // Two concurrent calls with the same id hit the API once.
 * const [a, b] = await Promise.all([fetchUser('1'), fetchUser('1')]);
 */
export function memoizeAsync<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
  options: MemoizeOptions = {}
): T & { cache: LRUCache<string, Awaited<ReturnType<T>>>; clear(): void } {
  type V = Awaited<ReturnType<T>>;
  const { cacheKey = defaultKey, ...cacheOpts } = options;
  const cache = new LRUCache<string, V>(cacheOpts);
  const inflight = new Map<string, Promise<V>>();

  const memoized = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    const key = cacheKey(...(args as unknown[]));

    // 1. Already in cache (and not expired)
    const cached = cache.get(key);
    if (cached !== undefined) return Promise.resolve(cached) as ReturnType<T>;
    if (cache.has(key)) return Promise.resolve(cached) as ReturnType<T>;

    // 2. Already in-flight — deduplicate
    const existing = inflight.get(key);
    if (existing) return existing as ReturnType<T>;

    // 3. New call — execute and cache result
    const promise = (fn.apply(this, args) as Promise<V>).then(
      (value) => {
        inflight.delete(key);
        cache.set(key, value);
        return value;
      },
      (err: unknown) => {
        inflight.delete(key); // don't cache errors
        throw err;
      }
    );
    inflight.set(key, promise);
    return promise as ReturnType<T>;
  } as unknown as T & { cache: LRUCache<string, V>; clear(): void };

  memoized.cache = cache;
  memoized.clear = () => { cache.clear(); inflight.clear(); };
  return memoized;
}
