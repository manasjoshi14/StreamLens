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
  runtime: {
    onMessage: { addListener: vi.fn() },
    sendMessage: vi.fn(),
  },
};
vi.stubGlobal('browser', mockBrowser);

const mockFetchRatings = vi.fn();
const mockFetchReviews = vi.fn();
vi.mock('../entrypoints/background/api-client', () => ({
  fetchRatings: (...args: any[]) => mockFetchRatings(...args),
  fetchReviews: (...args: any[]) => mockFetchReviews(...args),
}));

import { handleMessage } from '../entrypoints/background/message-handler';
import { clearAllCache } from '../entrypoints/background/cache';
import type { Message, MessageResponse } from '../lib/messages';
import type { RatingsData } from '../lib/types';

const mockRatings: RatingsData = {
  title: 'Inception',
  year: '2010',
  imdbRating: '8.8',
  imdbId: 'tt1375666',
  rottenTomatoesScore: '87',
  metacriticScore: '74',
  plot: 'A thief...',
  genre: 'Sci-Fi',
  poster: 'https://example.com/poster.jpg',
  type: 'movie',
  rated: 'PG-13',
  runtime: '148 min',
  actors: 'Leonardo DiCaprio',
  director: 'Christopher Nolan',
  lowConfidence: false,
};

function sendMessage(message: Message): Promise<MessageResponse> {
  return new Promise(resolve => {
    handleMessage(message, {} as any, resolve);
  });
}

describe('handleGetRatings', () => {
  beforeEach(async () => {
    mockFetchRatings.mockReset();
    mockFetchReviews.mockReset();
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    await clearAllCache();
  });

  it('returns ok status on successful API result', async () => {
    mockFetchRatings.mockResolvedValue(mockRatings);
    const resp = await sendMessage({
      type: 'GET_RATINGS',
      payload: { title: 'Inception', year: '2010' },
    });
    expect(resp.type).toBe('RATINGS');
    if (resp.type === 'RATINGS') {
      expect(resp.data).toEqual(mockRatings);
      expect(resp.status).toBe('ok');
    }
  });

  it('caches positive result in storage', async () => {
    mockFetchRatings.mockResolvedValue(mockRatings);
    await sendMessage({
      type: 'GET_RATINGS',
      payload: { title: 'Inception', year: '2010' },
    });
    expect(mockStorage['cache:inception:2010']).toBeDefined();
    expect(mockStorage['cache:inception:2010'].data).toEqual(mockRatings);
  });

  it('returns no-match status when API finds nothing', async () => {
    mockFetchRatings.mockResolvedValue(null);
    const resp = await sendMessage({
      type: 'GET_RATINGS',
      payload: { title: 'Nonexistent Movie XYZ' },
    });
    expect(resp.type).toBe('RATINGS');
    if (resp.type === 'RATINGS') {
      expect(resp.data).toBeNull();
      expect(resp.status).toBe('no-match');
    }
  });

  it('caches no-match result', async () => {
    mockFetchRatings.mockResolvedValue(null);
    await sendMessage({
      type: 'GET_RATINGS',
      payload: { title: 'Nonexistent Movie XYZ' },
    });
    expect(mockStorage['nomatch:nonexistent movie xyz']).toBeDefined();
    expect(mockStorage['nomatch:nonexistent movie xyz'].noMatch).toBe(true);
  });

  it('returns cached no-match without calling API', async () => {
    mockFetchRatings.mockResolvedValue(null);
    // First call — hits API
    await sendMessage({
      type: 'GET_RATINGS',
      payload: { title: 'Ghost Title' },
    });
    expect(mockFetchRatings).toHaveBeenCalledTimes(1);

    // Second call — should hit no-match cache
    const resp = await sendMessage({
      type: 'GET_RATINGS',
      payload: { title: 'Ghost Title' },
    });
    expect(mockFetchRatings).toHaveBeenCalledTimes(1);
    if (resp.type === 'RATINGS') {
      expect(resp.status).toBe('no-match');
    }
  });

  it('returns rate-limited status without caching', async () => {
    mockFetchRatings.mockRejectedValue(new Error('rate-limited'));
    const resp = await sendMessage({
      type: 'GET_RATINGS',
      payload: { title: 'Some Movie' },
    });
    if (resp.type === 'RATINGS') {
      expect(resp.status).toBe('rate-limited');
      expect(resp.data).toBeNull();
    }
    // Should NOT cache
    expect(mockStorage['nomatch:some movie']).toBeUndefined();
    expect(mockStorage['cache:some movie']).toBeUndefined();
  });

  it('returns error status without caching', async () => {
    mockFetchRatings.mockRejectedValue(new Error('Network error'));
    const resp = await sendMessage({
      type: 'GET_RATINGS',
      payload: { title: 'Broken Movie' },
    });
    if (resp.type === 'RATINGS') {
      expect(resp.status).toBe('error');
      expect(resp.data).toBeNull();
      expect(resp.error).toBe('Network error');
    }
    expect(mockStorage['nomatch:broken movie']).toBeUndefined();
  });
});
