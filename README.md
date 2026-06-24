# memokit

[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors-)

Memoization with LRU eviction and TTL expiry. `memoize()`, `memoizeAsync()` (deduplicates concurrent calls), and a standalone `LRUCache` class. Zero dependencies, TypeScript-first.

[![npm](https://img.shields.io/npm/v/memokit)](https://www.npmjs.com/package/memokit)
[![npm downloads](https://img.shields.io/npm/dw/memokit)](https://www.npmjs.com/package/memokit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Why memokit?

| Package | Problem |
|---------|---------|
| `memoize-one` (550k/week) | No LRU, no TTL, only last-call cache |
| `mem` (7M/week) | No LRU eviction, basic TTL only |
| `memoizee` (700k/week) | Abandoned 2019; no TypeScript types |
| `lru-cache` (40M/week) | Cache only — no memoize wrapper |
| **memokit** | LRU + TTL + async dedup + zero deps |

Inspired by Python's `functools.lru_cache`, Java's Guava `CacheBuilder`, Go's `ristretto`.

## Install

```bash
npm install memokit
```

## Quick start

```ts
import { memoize, memoizeAsync } from "memokit";

// Memoize fibonacci — cache grows without bound
const fib = memoize((n: number): number => n <= 1 ? n : fib(n-1) + fib(n-2));
fib(50); // instant

// Memoize API call — LRU (100 entries) + TTL (30 seconds)
const getUser = memoizeAsync(
  async (id: string) => fetchUser(id),
  { maxSize: 100, ttl: 30_000 }
);

// Concurrent calls with same id only hit the API once
const [user1, user2] = await Promise.all([getUser("abc"), getUser("abc")]);
```

## API

### `memoize(fn, options?)`

Memoize a synchronous function.

```ts
import { memoize } from "memokit";

const expensive = memoize(
  (a: number, b: number) => heavyComputation(a, b),
  {
    maxSize: 500,   // keep only 500 most recently used results (LRU)
    ttl: 60_000,    // expire entries after 60 seconds
  }
);

expensive(1, 2);  // computed
expensive(1, 2);  // cached
expensive(1, 2);  // still cached (unless TTL expired)

// Access the underlying cache
expensive.cache.size;     // number of cached entries
expensive.cache.get(key); // direct access
expensive.clear();        // clear all entries
```

### `memoizeAsync(fn, options?)`

Memoize an async function. **Deduplicates concurrent calls** — if two calls with the same arguments are in-flight simultaneously, only one hits the underlying function.

Errors are **not** cached — a rejected promise allows the next call to retry.

```ts
import { memoizeAsync } from "memokit";

const fetchProduct = memoizeAsync(
  async (id: string) => api.getProduct(id),
  { maxSize: 200, ttl: 5 * 60_000 }  // LRU 200, TTL 5 min
);

// 100 concurrent requests for the same product → 1 API call
const results = await Promise.all(
  Array.from({ length: 100 }, () => fetchProduct("product-123"))
);
```

### `MemoizeOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxSize` | `number` | `Infinity` | Max cache entries; LRU eviction when exceeded |
| `ttl` | `number` | none | Time-to-live in milliseconds |
| `cacheKey` | `(...args) => string` | `JSON.stringify(args)` | Custom key function |

### `LRUCache<K, V>`

The underlying O(1) LRU cache (doubly-linked list + Map). Useful standalone.

```ts
import { LRUCache } from "memokit";

const cache = new LRUCache<string, User>({ maxSize: 100, ttl: 30_000 });

cache.set("user:1", { name: "Alice" });
cache.get("user:1");    // { name: "Alice" }
cache.has("user:1");    // true
cache.delete("user:1"); // true
cache.size;             // 0
cache.clear();
cache.keys();           // string[]
cache.values();         // User[]
```

**LRU behavior:** When `maxSize` is exceeded, the least recently used entry is evicted. `get()` and `set()` both move entries to the "most recently used" position.

**TTL behavior:** Expired entries are removed lazily on access (no background timer). `has()` and `get()` both detect and remove expired entries.

## Patterns

### Debounce-style memoization with TTL

```ts
// Cache a result for 1 second, then recompute
const current = memoize(() => Date.now(), { ttl: 1000 });
current(); // fresh value
current(); // same value (within 1s)
// after 1s → recomputes
```

### Custom key for object arguments

```ts
const lookup = memoize(
  (user: { id: string; locale: string }) => translate(user),
  { cacheKey: (u: unknown) => `${(u as {id:string}).id}:${(u as {locale:string}).locale}` }
);
```

### Request deduplication for data fetching

```ts
const loadData = memoizeAsync(
  async (url: string) => fetch(url).then(r => r.json()),
  { ttl: 5000 } // cache for 5 seconds
);

// Two components fetching same URL simultaneously → one HTTP request
const [a, b] = await Promise.all([loadData("/api/data"), loadData("/api/data")]);
```

### Fixed-size LRU cache

```ts
const cache = new LRUCache<number, string>({ maxSize: 3 });
cache.set(1, "one").set(2, "two").set(3, "three");
cache.set(4, "four"); // evicts 1 (least recently used)
cache.get(1);         // undefined
```

## Contributors ✨

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind are welcome — code, docs, bug reports, ideas, reviews! See the [emoji key](https://allcontributors.org/docs/en/emoji-key) for how each contribution is recognized, and open a PR or issue to get involved.

Thanks goes to these wonderful people:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/trananhtung"><img src="https://avatars.githubusercontent.com/u/30992229?v=4?s=100" width="100px;" alt="Tung Tran"/><br /><sub><b>Tung Tran</b></sub></a><br /><a href="https://github.com/trananhtung/memokit/commits?author=trananhtung" title="Code">💻</a> <a href="#maintenance-trananhtung" title="Maintenance">🚧</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License

MIT
