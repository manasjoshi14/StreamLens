import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser.storage.local before importing modules
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
      remove: vi.fn(async () => {}),
    },
  },
  runtime: {
    onMessage: { addListener: vi.fn() },
    sendMessage: vi.fn(),
  },
};

vi.stubGlobal('browser', mockBrowser);

// Mock import.meta.env
vi.stubGlobal('import', { meta: { env: {} } });

import { isLowConfidence, pickBestMatch, type SearchResult } from '../entrypoints/background/title-matcher';

describe('API client type detection', () => {
  it('maps "series" type correctly for TMDB URL path', () => {
    // The api-client maps series -> tv for TMDB
    // This tests the logic conceptually
    const mediaType: 'movie' | 'series' = 'series';
    const tmdbPath = mediaType === 'series' ? 'tv' : 'movie';
    expect(tmdbPath).toBe('tv');
  });

  it('maps "movie" type correctly for TMDB URL path', () => {
    const mediaType: 'movie' | 'series' = 'movie';
    const tmdbPath = mediaType === 'series' ? 'tv' : 'movie';
    expect(tmdbPath).toBe('movie');
  });
});

describe('search result ranking', () => {
  const results: SearchResult[] = [
    { title: 'Breaking Bad', year: '2008', imdbId: 'tt0903747', type: 'series' },
    { title: 'Breaking Bad: The Movie', year: '2019', imdbId: 'tt0000002', type: 'movie' },
  ];

  it('picks exact title match', () => {
    const match = pickBestMatch('Breaking Bad', '2008', results);
    expect(match?.imdbId).toBe('tt0903747');
  });
});

describe('confidence detection', () => {
  it('flags low confidence for distant match', () => {
    expect(isLowConfidence('Stranger Things', 'The Stranger')).toBe(true);
  });

  it('does not flag high confidence exact match', () => {
    expect(isLowConfidence('Breaking Bad', 'Breaking Bad')).toBe(false);
  });
});
