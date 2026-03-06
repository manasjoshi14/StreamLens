import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStorage: Record<string, any> = {};
const mockBrowser = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[] | null) => {
        if (keys === null) return { ...mockStorage };
        if (typeof keys === 'string') {
          return { [keys]: mockStorage[keys] };
        }
        const result: Record<string, any> = {};
        for (const k of keys) {
          if (mockStorage[k] !== undefined) result[k] = mockStorage[k];
        }
        return result;
      }),
      set: vi.fn(async (items: Record<string, any>) => {
        Object.assign(mockStorage, items);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const arr = typeof keys === 'string' ? [keys] : keys;
        for (const k of arr) delete mockStorage[k];
      }),
    },
  },
};
vi.stubGlobal('browser', mockBrowser);

import { getCacheKey, getFromMemory, setInMemory, getNoMatch, getNoMatchFull, setNoMatch } from '../entrypoints/background/cache';
import type { RatingsData } from '../lib/types';
import { CACHE_TTL_MS } from '../lib/constants';

const mockRatings: RatingsData = {
  title: 'Inception',
  year: '2010',
  imdbRating: '8.8',
  imdbId: 'tt1375666',
  rottenTomatoesScore: '87',
  metacriticScore: '74',
  plot: 'A thief who steals corporate secrets...',
  genre: 'Action, Adventure, Sci-Fi',
  poster: 'https://example.com/poster.jpg',
  type: 'movie',
  rated: 'PG-13',
  runtime: '148 min',
  actors: 'Leonardo DiCaprio',
  director: 'Christopher Nolan',
  lowConfidence: false,
};

describe('getCacheKey', () => {
  it('uses netflix ID when available', () => {
    expect(getCacheKey('12345')).toBe('nfx:12345');
  });

  it('uses normalized title and year', () => {
    expect(getCacheKey(undefined, 'Inception', '2010')).toBe('inception:2010');
  });

  it('uses normalized title only when no year', () => {
    expect(getCacheKey(undefined, 'Inception')).toBe('inception');
  });

  it('handles leading/trailing spaces', () => {
    expect(getCacheKey(undefined, '  Inception  ', '2010')).toBe('inception:2010');
  });
});

describe('memory cache', () => {
  beforeEach(() => {
    // Clear by setting and getting a fresh state — no direct clear exposed
    // We'll just test fresh entries
  });

  it('stores and retrieves from memory', () => {
    setInMemory('test-key', mockRatings);
    const result = getFromMemory('test-key');
    expect(result).toEqual(mockRatings);
  });

  it('returns null for missing key', () => {
    expect(getFromMemory('nonexistent-key-12345')).toBeNull();
  });

  it('respects LRU eviction', () => {
    for (let i = 0; i < 501; i++) {
      setInMemory(`lru-test-${i}`, { ...mockRatings, title: `Movie ${i}` });
    }
    // First entry should be evicted
    expect(getFromMemory('lru-test-0')).toBeNull();
    // Last entry should exist
    expect(getFromMemory('lru-test-500')).not.toBeNull();
  });
});

describe('no-match cache', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  });

  it('returns false for unknown keys', () => {
    expect(getNoMatch('unknown-key-xyz')).toBe(false);
  });

  it('stores and retrieves no-match entry', async () => {
    await setNoMatch('no-match-test');
    expect(getNoMatch('no-match-test')).toBe(true);
  });

  it('persists to storage and retrieves via getNoMatchFull', async () => {
    await setNoMatch('storage-nm-test');
    expect(mockStorage['nomatch:storage-nm-test']).toBeDefined();
    expect(mockStorage['nomatch:storage-nm-test'].noMatch).toBe(true);
    const result = await getNoMatchFull('storage-nm-test');
    expect(result).toBe(true);
  });

  it('expires after TTL', async () => {
    await setNoMatch('expired-nm');
    // Manually expire the entry
    const key = 'nomatch:expired-nm';
    mockStorage[key].timestamp = Date.now() - CACHE_TTL_MS - 1;
    // Memory cache also needs expiring — getNoMatch reads from memory
    // Call getNoMatchFull which checks storage after memory miss on expiry
    const result = await getNoMatchFull('expired-nm');
    // The memory entry is also expired (same timestamp object)
    expect(getNoMatch('expired-nm')).toBe(false);
  });

  it('evicts oldest no-match memory entries with LRU cap', async () => {
    for (let i = 0; i < 501; i++) {
      await setNoMatch(`nm-${i}`);
    }

    expect(getNoMatch('nm-0')).toBe(false);
    expect(getNoMatch('nm-500')).toBe(true);
  });
});
