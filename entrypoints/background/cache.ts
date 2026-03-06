import type { CacheEntry, NoMatchEntry, RatingsData } from '../../lib/types';
import { LRU_MAX_ENTRIES, CACHE_TTL_MS, STORAGE_KEYS } from '../../lib/constants';

const memoryCache = new Map<string, CacheEntry<RatingsData>>();
const noMatchMemoryCache = new Map<string, NoMatchEntry>();

function setNoMatchInMemory(key: string, entry: NoMatchEntry): void {
  if (noMatchMemoryCache.size >= LRU_MAX_ENTRIES) {
    const oldest = noMatchMemoryCache.keys().next().value;
    if (oldest !== undefined) {
      noMatchMemoryCache.delete(oldest);
    }
  }
  noMatchMemoryCache.set(key, entry);
}

export function getCacheKey(netflixId?: string, title?: string, year?: string): string {
  if (netflixId) return `nfx:${netflixId}`;
  const normalizedTitle = (title || '').toLowerCase().trim();
  return year ? `${normalizedTitle}:${year}` : normalizedTitle;
}

export function getFromMemory(key: string): RatingsData | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }

  // Move to end (LRU refresh)
  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.data;
}

export function setInMemory(key: string, data: RatingsData): void {
  if (memoryCache.size >= LRU_MAX_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) {
      memoryCache.delete(oldest);
    }
  }
  memoryCache.set(key, { data, timestamp: Date.now() });
}

export async function getFromStorage(key: string): Promise<RatingsData | null> {
  try {
    const result = await browser.storage.local.get(`cache:${key}`);
    const entry = result[`cache:${key}`] as CacheEntry<RatingsData> | undefined;
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      await browser.storage.local.remove(`cache:${key}`);
      return null;
    }

    // Populate memory cache on read
    setInMemory(key, entry.data);
    return entry.data;
  } catch {
    return null;
  }
}

export async function setInStorage(key: string, data: RatingsData): Promise<void> {
  try {
    await browser.storage.local.set({
      [`cache:${key}`]: { data, timestamp: Date.now() } satisfies CacheEntry<RatingsData>,
    });
  } catch {
    // Storage quota exceeded — silently fail, memory cache still works
  }
}

export async function getRating(key: string): Promise<RatingsData | null> {
  // Tier 1: Memory
  const mem = getFromMemory(key);
  if (mem) return mem;

  // Tier 2: Storage
  const stored = await getFromStorage(key);
  return stored;
}

export async function setRating(key: string, data: RatingsData): Promise<void> {
  setInMemory(key, data);
  await setInStorage(key, data);
}

export function getNoMatch(key: string): boolean {
  const entry = noMatchMemoryCache.get(key);
  if (!entry) return false;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    noMatchMemoryCache.delete(key);
    return false;
  }
  // Move to end (LRU refresh)
  noMatchMemoryCache.delete(key);
  noMatchMemoryCache.set(key, entry);
  return true;
}

export async function getNoMatchFull(key: string): Promise<boolean> {
  if (getNoMatch(key)) return true;
  try {
    const result = await browser.storage.local.get(`nomatch:${key}`);
    const entry = result[`nomatch:${key}`] as NoMatchEntry | undefined;
    if (!entry) return false;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      await browser.storage.local.remove(`nomatch:${key}`);
      return false;
    }
    setNoMatchInMemory(key, entry);
    return true;
  } catch {
    return false;
  }
}

export async function setNoMatch(key: string): Promise<void> {
  const entry: NoMatchEntry = { noMatch: true, timestamp: Date.now() };
  setNoMatchInMemory(key, entry);
  try {
    await browser.storage.local.set({ [`nomatch:${key}`]: entry });
  } catch {}
}

export async function getCacheStats(): Promise<number> {
  const all = await browser.storage.local.get(null);
  return Object.keys(all).filter(k => k.startsWith('cache:') || k.startsWith('nomatch:')).length;
}

export async function clearAllCache(): Promise<void> {
  memoryCache.clear();
  noMatchMemoryCache.clear();
  const all = await browser.storage.local.get(null);
  const cacheKeys = Object.keys(all).filter(k => k.startsWith('cache:') || k.startsWith('nomatch:'));
  if (cacheKeys.length > 0) {
    await browser.storage.local.remove(cacheKeys);
  }
}
