/**
 * Doubly-linked-list LRU cache.
 * O(1) get, set, delete, has via Map + linked list.
 */

interface Node<K, V> {
  key: K;
  value: V;
  expiry: number | null; // ms timestamp or null = no TTL
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
}

export interface LRUCacheOptions {
  /** Max number of entries before evicting the least recently used. Default: Infinity. */
  maxSize?: number;
  /** Time-to-live in milliseconds. Entries older than this are treated as missing. Default: no TTL. */
  ttl?: number;
}

export class LRUCache<K, V> {
  private readonly _maxSize: number;
  private readonly _ttl: number | null;
  private readonly _map: Map<K, Node<K, V>> = new Map();
  // Sentinel head/tail — simplifies edge cases
  private readonly _head: Node<K, V>;
  private readonly _tail: Node<K, V>;

  constructor(options: LRUCacheOptions = {}) {
    this._maxSize = options.maxSize ?? Infinity;
    this._ttl = options.ttl ?? null;
    if (this._maxSize <= 0) throw new RangeError("LRUCache maxSize must be > 0");
    this._head = { key: null!, value: null!, expiry: null, prev: null, next: null };
    this._tail = { key: null!, value: null!, expiry: null, prev: null, next: null };
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  get size(): number { return this._map.size; }

  has(key: K): boolean {
    const node = this._map.get(key);
    if (!node) return false;
    if (this._isExpired(node)) { this._delete(node); return false; }
    return true;
  }

  get(key: K): V | undefined {
    const node = this._map.get(key);
    if (!node) return undefined;
    if (this._isExpired(node)) { this._delete(node); return undefined; }
    this._moveToFront(node);
    return node.value;
  }

  set(key: K, value: V): this {
    const existing = this._map.get(key);
    if (existing) {
      existing.value = value;
      existing.expiry = this._ttl !== null ? Date.now() + this._ttl : null;
      this._moveToFront(existing);
      return this;
    }
    const node: Node<K, V> = {
      key, value,
      expiry: this._ttl !== null ? Date.now() + this._ttl : null,
      prev: null, next: null,
    };
    this._map.set(key, node);
    this._addToFront(node);
    if (this._map.size > this._maxSize) this._evictLRU();
    return this;
  }

  delete(key: K): boolean {
    const node = this._map.get(key);
    if (!node) return false;
    this._delete(node);
    return true;
  }

  clear(): void {
    this._map.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  keys(): K[] {
    const result: K[] = [];
    let node = this._head.next;
    while (node && node !== this._tail) {
      if (!this._isExpired(node)) result.push(node.key);
      else this._delete(node);
      node = node.next;
    }
    return result;
  }

  values(): V[] {
    const result: V[] = [];
    let node = this._head.next;
    while (node && node !== this._tail) {
      if (!this._isExpired(node)) result.push(node.value);
      else this._delete(node);
      node = node.next;
    }
    return result;
  }

  private _isExpired(node: Node<K, V>): boolean {
    return node.expiry !== null && Date.now() > node.expiry;
  }

  private _addToFront(node: Node<K, V>): void {
    node.prev = this._head;
    node.next = this._head.next;
    this._head.next!.prev = node;
    this._head.next = node;
  }

  private _removeFromList(node: Node<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private _moveToFront(node: Node<K, V>): void {
    this._removeFromList(node);
    this._addToFront(node);
  }

  private _delete(node: Node<K, V>): void {
    this._removeFromList(node);
    this._map.delete(node.key);
  }

  private _evictLRU(): void {
    const lru = this._tail.prev;
    if (lru && lru !== this._head) this._delete(lru);
  }
}
