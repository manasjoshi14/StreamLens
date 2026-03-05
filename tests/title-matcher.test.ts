import { describe, it, expect } from 'vitest';
import { levenshteinDistance, similarity, isLowConfidence, pickBestMatch } from '../entrypoints/background/title-matcher';

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('returns length for empty string', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5);
    expect(levenshteinDistance('hello', '')).toBe(5);
  });

  it('computes distance correctly', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
  });
});

describe('similarity', () => {
  it('returns 1 for identical strings', () => {
    expect(similarity('Inception', 'Inception')).toBe(1);
  });

  it('is case-insensitive', () => {
    expect(similarity('inception', 'INCEPTION')).toBe(1);
  });

  it('returns high similarity for close strings', () => {
    expect(similarity('The Matrix', 'Matrix')).toBeGreaterThan(0.5);
  });

  it('returns low similarity for different strings', () => {
    expect(similarity('Inception', 'Jaws')).toBeLessThan(0.3);
  });
});

describe('isLowConfidence', () => {
  it('returns false for exact match', () => {
    expect(isLowConfidence('Inception', 'Inception')).toBe(false);
  });

  it('returns false for close match', () => {
    expect(isLowConfidence('The Dark Knight', 'The Dark Knight')).toBe(false);
  });

  it('returns true for poor match', () => {
    expect(isLowConfidence('Inception', 'The Shawshank Redemption')).toBe(true);
  });
});

describe('pickBestMatch', () => {
  const results = [
    { title: 'Inception', year: '2010', imdbId: 'tt1375666', type: 'movie' },
    { title: 'Inception: The Cobol Job', year: '2010', imdbId: 'tt1790736', type: 'movie' },
    { title: 'The Inception', year: '2015', imdbId: 'tt0000001', type: 'movie' },
  ];

  it('picks the closest title match', () => {
    const match = pickBestMatch('Inception', '2010', results);
    expect(match?.imdbId).toBe('tt1375666');
  });

  it('considers year in scoring', () => {
    const match = pickBestMatch('The Inception', '2015', results);
    expect(match?.imdbId).toBe('tt0000001');
  });

  it('returns null for empty results', () => {
    expect(pickBestMatch('Inception', undefined, [])).toBeNull();
  });
});
