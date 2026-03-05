import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processedMap, makeDedupeKey, isDuplicate, getCooldownMs } from '../entrypoints/netflix.content/hover-injector';

// Mock window.location for context detection
const locationMock = { search: '' };
vi.stubGlobal('window', { location: locationMock });

beforeEach(() => {
  processedMap.clear();
  locationMock.search = '';
});

describe('makeDedupeKey', () => {
  it('prefers title over netflixId for stable dedup', () => {
    expect(makeDedupeKey('81587834', 'Raazi')).toBe('hover:raazi');
  });

  it('uses jbv context when URL contains jbv=', () => {
    locationMock.search = '?jbv=81587834';
    expect(makeDedupeKey('81587834', 'Raazi')).toBe('jbv:raazi');
  });

  it('falls back to netflixId when no title', () => {
    expect(makeDedupeKey('81587834', null)).toBe('hover:81587834');
  });

  it('returns null when both are null', () => {
    expect(makeDedupeKey(null, null)).toBeNull();
  });

  it('trims and lowercases title keys', () => {
    expect(makeDedupeKey(null, '  The Matrix  ')).toBe('hover:the matrix');
  });

  it('same title with different IDs produces same key', () => {
    expect(makeDedupeKey('70155590', 'The Mentalist')).toBe('hover:the mentalist');
    expect(makeDedupeKey('80014298', 'The Mentalist')).toBe('hover:the mentalist');
  });
});

describe('isDuplicate', () => {
  it('returns false for unseen keys', () => {
    expect(isDuplicate('hover:123')).toBe(false);
  });

  it('returns true within hover cooldown window', () => {
    processedMap.set('hover:the mentalist', Date.now());
    expect(isDuplicate('hover:the mentalist')).toBe(true);
  });

  it('returns false after hover cooldown expires', () => {
    processedMap.set('hover:the mentalist', Date.now() - 1500);
    expect(isDuplicate('hover:the mentalist')).toBe(false);
  });

  it('uses longer cooldown for jbv context', () => {
    locationMock.search = '?jbv=123';
    expect(getCooldownMs()).toBe(30_000);

    // Still within jbv cooldown at 5s ago
    processedMap.set('jbv:the mentalist', Date.now() - 5000);
    expect(isDuplicate('jbv:the mentalist')).toBe(true);

    // Expired after 30s
    processedMap.set('jbv:the mentalist', Date.now() - 31_000);
    expect(isDuplicate('jbv:the mentalist')).toBe(false);
  });
});

describe('context-aware dedup', () => {
  it('same title in different contexts are independent', () => {
    locationMock.search = '';
    processedMap.set('hover:raazi', Date.now());

    locationMock.search = '?jbv=81587834';
    const key = makeDedupeKey('81587834', 'Raazi')!;
    expect(key).toBe('jbv:raazi');
    expect(isDuplicate(key)).toBe(false);
  });
});

describe('ghost modal prevention', () => {
  it('null title + null ID produces no key', () => {
    const key = makeDedupeKey(null, null);
    expect(key).toBeNull();
    expect(processedMap.size).toBe(0);
  });
});
