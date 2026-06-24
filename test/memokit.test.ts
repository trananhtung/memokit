import { jest } from "@jest/globals";
import { LRUCache, memoize, memoizeAsync } from "../src/index.js";

// ── LRUCache ──────────────────────────────────────────────────────────────────

describe("LRUCache — basic", () => {
  test("set and get", () => {
    const c = new LRUCache<string, number>();
    c.set("a", 1).set("b", 2);
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBe(2);
  });

  test("missing key returns undefined", () => {
    expect(new LRUCache().get("x")).toBeUndefined();
  });

  test("has()", () => {
    const c = new LRUCache<string, number>();
    c.set("a", 1);
    expect(c.has("a")).toBe(true);
    expect(c.has("b")).toBe(false);
  });

  test("overwrite existing key", () => {
    const c = new LRUCache<string, number>();
    c.set("a", 1);
    c.set("a", 99);
    expect(c.get("a")).toBe(99);
    expect(c.size).toBe(1);
  });

  test("delete", () => {
    const c = new LRUCache<string, number>();
    c.set("a", 1);
    expect(c.delete("a")).toBe(true);
    expect(c.get("a")).toBeUndefined();
    expect(c.delete("a")).toBe(false);
  });

  test("clear", () => {
    const c = new LRUCache<string, number>();
    c.set("a", 1).set("b", 2);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.get("a")).toBeUndefined();
  });

  test("size", () => {
    const c = new LRUCache<string, number>();
    expect(c.size).toBe(0);
    c.set("a", 1);
    expect(c.size).toBe(1);
    c.set("b", 2);
    expect(c.size).toBe(2);
    c.delete("a");
    expect(c.size).toBe(1);
  });

  test("keys() and values()", () => {
    const c = new LRUCache<string, number>();
    c.set("a", 1).set("b", 2).set("c", 3);
    // LRU order: most recent first
    expect(new Set(c.keys())).toEqual(new Set(["a","b","c"]));
    expect(new Set(c.values())).toEqual(new Set([1,2,3]));
  });

  test("maxSize=0 throws", () => {
    expect(() => new LRUCache({ maxSize: 0 })).toThrow(RangeError);
  });
});

describe("LRUCache — LRU eviction", () => {
  test("evicts least recently used when maxSize exceeded", () => {
    const c = new LRUCache<string, number>({ maxSize: 3 });
    c.set("a", 1).set("b", 2).set("c", 3);
    c.set("d", 4); // evicts "a"
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
    expect(c.get("d")).toBe(4);
    expect(c.size).toBe(3);
  });

  test("get() moves to front (protects from eviction)", () => {
    const c = new LRUCache<string, number>({ maxSize: 3 });
    c.set("a", 1).set("b", 2).set("c", 3);
    c.get("a"); // a is now most recently used
    c.set("d", 4); // should evict "b", not "a"
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBeUndefined();
  });

  test("set() on existing key moves to front", () => {
    const c = new LRUCache<string, number>({ maxSize: 3 });
    c.set("a", 1).set("b", 2).set("c", 3);
    c.set("a", 10); // refresh a
    c.set("d", 4);  // should evict "b"
    expect(c.get("a")).toBe(10);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("c")).toBe(3);
    expect(c.get("d")).toBe(4);
  });

  test("maxSize=1", () => {
    const c = new LRUCache<string, number>({ maxSize: 1 });
    c.set("a", 1);
    c.set("b", 2);
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(2);
  });
});

describe("LRUCache — TTL", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("entry accessible before TTL", () => {
    const c = new LRUCache<string, number>({ ttl: 1000 });
    c.set("a", 1);
    jest.advanceTimersByTime(999);
    expect(c.get("a")).toBe(1);
  });

  test("entry expired after TTL", () => {
    const c = new LRUCache<string, number>({ ttl: 1000 });
    c.set("a", 1);
    jest.advanceTimersByTime(1001);
    expect(c.get("a")).toBeUndefined();
    expect(c.has("a")).toBe(false);
  });

  test("expired entries removed on access (lazy deletion)", () => {
    const c = new LRUCache<string, number>({ ttl: 500 });
    c.set("a", 1).set("b", 2);
    jest.advanceTimersByTime(501);
    // Before access: size still reflects internal map (lazy deletion)
    expect(c.get("a")).toBeUndefined(); // triggers deletion of "a"
    expect(c.get("b")).toBeUndefined(); // triggers deletion of "b"
    expect(c.size).toBe(0); // both cleaned up now
  });

  test("re-setting refreshes TTL", () => {
    const c = new LRUCache<string, number>({ ttl: 1000 });
    c.set("a", 1);
    jest.advanceTimersByTime(800);
    c.set("a", 2); // reset
    jest.advanceTimersByTime(800);
    expect(c.get("a")).toBe(2);
  });
});

// ── memoize ───────────────────────────────────────────────────────────────────

describe("memoize — basic", () => {
  test("caches result of pure function", () => {
    let calls = 0;
    const fn = memoize((x: number) => { calls++; return x * 2; });
    expect(fn(5)).toBe(10);
    expect(fn(5)).toBe(10);
    expect(calls).toBe(1);
  });

  test("different args called separately", () => {
    let calls = 0;
    const fn = memoize((x: number) => { calls++; return x * 2; });
    fn(1); fn(2); fn(1);
    expect(calls).toBe(2);
  });

  test("multiple arguments", () => {
    let calls = 0;
    const fn = memoize((a: number, b: number) => { calls++; return a + b; });
    expect(fn(1, 2)).toBe(3);
    expect(fn(1, 2)).toBe(3);
    expect(fn(2, 1)).toBe(3);
    expect(calls).toBe(2); // (1,2) and (2,1) are different keys
  });

  test("string arguments", () => {
    let calls = 0;
    const fn = memoize((s: string) => { calls++; return s.toUpperCase(); });
    expect(fn("hello")).toBe("HELLO");
    expect(fn("hello")).toBe("HELLO");
    expect(calls).toBe(1);
  });

  test("cache.size reflects entries", () => {
    const fn = memoize((x: number) => x * 2);
    fn(1); fn(2); fn(3);
    expect(fn.cache.size).toBe(3);
  });

  test("clear() empties cache", () => {
    let calls = 0;
    const fn = memoize((x: number) => { calls++; return x; });
    fn(1);
    fn.clear();
    fn(1);
    expect(calls).toBe(2);
  });

  test("custom cacheKey", () => {
    let calls = 0;
    const fn = memoize(
      (obj: { id: number }) => { calls++; return obj.id; },
      { cacheKey: (obj: unknown) => String((obj as { id: number }).id) }
    );
    fn({ id: 1 }); fn({ id: 1 });
    expect(calls).toBe(1);
  });

  test("fibonacci with memoize", () => {
    const fib = memoize((n: number): number => n <= 1 ? n : fib(n - 1) + fib(n - 2));
    expect(fib(10)).toBe(55);
    expect(fib(20)).toBe(6765);
  });
});

describe("memoize — LRU eviction", () => {
  test("evicts oldest when maxSize exceeded", () => {
    let calls = 0;
    const fn = memoize((x: number) => { calls++; return x * 2; }, { maxSize: 2 });
    fn(1); fn(2); fn(3); // 1 evicted; cache: {3 MRU, 2 LRU}
    expect(fn.cache.size).toBe(2);
    calls = 0;
    fn(1); // cache miss — recomputed; 2 evicted; cache: {1 MRU, 3 LRU}
    expect(calls).toBe(1);
    fn(3); // still cached (3 survived)
    expect(calls).toBe(1);
    fn(2); // cache miss (2 was evicted when 1 was re-added)
    expect(calls).toBe(2);
  });
});

describe("memoize — TTL", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("returns cached value before TTL", () => {
    let calls = 0;
    const fn = memoize((x: number) => { calls++; return x; }, { ttl: 1000 });
    fn(1);
    jest.advanceTimersByTime(999);
    fn(1);
    expect(calls).toBe(1);
  });

  test("recomputes after TTL", () => {
    let calls = 0;
    const fn = memoize((x: number) => { calls++; return x; }, { ttl: 1000 });
    fn(1);
    jest.advanceTimersByTime(1001);
    fn(1);
    expect(calls).toBe(2);
  });
});

// ── memoizeAsync ──────────────────────────────────────────────────────────────

describe("memoizeAsync — basic", () => {
  test("caches resolved value", async () => {
    let calls = 0;
    const fn = memoizeAsync(async (x: number) => { calls++; return x * 2; });
    expect(await fn(5)).toBe(10);
    expect(await fn(5)).toBe(10);
    expect(calls).toBe(1);
  });

  test("different args resolved separately", async () => {
    let calls = 0;
    const fn = memoizeAsync(async (x: number) => { calls++; return x * 2; });
    await fn(1); await fn(2); await fn(1);
    expect(calls).toBe(2);
  });

  test("deduplicates concurrent calls with same key", async () => {
    let calls = 0;
    const fn = memoizeAsync(async (x: number) => {
      calls++;
      await new Promise(r => setTimeout(r, 10));
      return x;
    });
    const [a, b, c] = await Promise.all([fn(1), fn(1), fn(1)]);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(c).toBe(1);
    expect(calls).toBe(1); // only one real call
  });

  test("does not cache rejected promises", async () => {
    let calls = 0;
    const fn = memoizeAsync(async (x: number) => {
      calls++;
      if (calls === 1) throw new Error("fail");
      return x;
    });
    await expect(fn(1)).rejects.toThrow("fail");
    expect(await fn(1)).toBe(1); // retried after error
    expect(calls).toBe(2);
  });

  test("clear() removes cached async results", async () => {
    let calls = 0;
    const fn = memoizeAsync(async (x: number) => { calls++; return x; });
    await fn(1);
    fn.clear();
    await fn(1);
    expect(calls).toBe(2);
  });

  test("clear() also clears in-flight promises", async () => {
    let calls = 0;
    const fn = memoizeAsync(async (x: number) => {
      calls++;
      await new Promise(r => setTimeout(r, 50));
      return x;
    });
    const p1 = fn(1);
    fn.clear();
    const p2 = fn(1); // new call after clear
    await Promise.all([p1, p2]);
    expect(calls).toBe(2);
  });
});

describe("memoizeAsync — TTL", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("cached async result expires after TTL", async () => {
    let calls = 0;
    const fn = memoizeAsync(async (x: number) => { calls++; return x; }, { ttl: 1000 });
    await fn(1);
    jest.advanceTimersByTime(1001);
    await fn(1);
    expect(calls).toBe(2);
  });
});

describe("memoizeAsync — maxSize", () => {
  test("evicts when async cache exceeds maxSize", async () => {
    let calls = 0;
    const fn = memoizeAsync(async (x: number) => { calls++; return x; }, { maxSize: 2 });
    await fn(1); await fn(2); await fn(3); // 1 evicted; cache: {3 MRU, 2 LRU}
    calls = 0;
    await fn(1); // miss — recomputed; 2 evicted; cache: {1 MRU, 3 LRU}
    expect(calls).toBe(1);
    await fn(3); // still cached (3 survived)
    expect(calls).toBe(1);
    await fn(2); // miss (2 was evicted when 1 was re-added)
    expect(calls).toBe(2);
  });
});
