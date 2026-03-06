import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStorage: Record<string, any> = {};

const mockBrowser = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => {
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

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { fetchRatings, fetchReviews } from '../entrypoints/background/api-client';
import { STORAGE_KEYS } from '../lib/constants';

function makeJsonResponse(body: any, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body),
  } as unknown as Response;
}

describe('api-client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];

    mockStorage[STORAGE_KEYS.omdbApiKey] = 'omdb-key';
    mockStorage[STORAGE_KEYS.tmdbApiKey] = 'tmdb-key';
    mockStorage[STORAGE_KEYS.dailyCounter] = { date: new Date().toISOString().split('T')[0], omdbCalls: 0 };
  });

  it('throws explicit error when OMDb returns non-OK status', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({}, 500));

    await expect(fetchRatings('Inception')).rejects.toThrow('OMDb request failed: 500');
  });

  it('uses tv reviews path for series', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({
      tv_results: [{ id: 42 }],
      movie_results: [],
    }));
    fetchMock.mockResolvedValueOnce(makeJsonResponse({
      results: [],
      total_results: 0,
    }));

    await fetchReviews('tt0903747', 'series');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/tv/42/reviews');
  });

  it('falls back to movie path when requested series is not found', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({
      tv_results: [],
      movie_results: [{ id: 77 }],
    }));
    fetchMock.mockResolvedValueOnce(makeJsonResponse({
      results: [],
      total_results: 0,
    }));

    await fetchReviews('tt1375666', 'series');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/movie/77/reviews');
  });

  it('throws explicit error when TMDB returns non-OK status', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({}, 503));

    await expect(fetchReviews('tt1375666', 'movie')).rejects.toThrow('TMDB request failed: 503');
  });

  it('returns null when no title passes minimum match threshold', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ Response: 'False', Error: 'Movie not found!' }));
    fetchMock.mockResolvedValueOnce(makeJsonResponse({
      Response: 'True',
      Search: [
        { Title: 'Jaws', Year: '1975', imdbID: 'tt0073195', Type: 'movie' },
        { Title: 'Alien', Year: '1979', imdbID: 'tt0078748', Type: 'movie' },
      ],
    }));

    const result = await fetchRatings('Stranger Things');
    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
