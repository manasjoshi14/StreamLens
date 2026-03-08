import { describe, it, expect } from 'vitest';
import type { RatingsData } from '../lib/types';
import { createBadgeHTML } from '../entrypoints/streaming.content/overlay-injector';

const ratings: RatingsData = {
  title: 'The Test Movie',
  year: '2024',
  imdbRating: '7.8',
  imdbId: 'tt1234567',
  rottenTomatoesScore: '83',
  metacriticScore: '69',
  plot: 'Plot',
  genre: 'Drama',
  poster: 'https://example.com/poster.jpg',
  type: 'movie',
  rated: 'UA 13+',
  runtime: '120 min',
  actors: 'Actor 1',
  director: 'Director 1',
  lowConfidence: false,
};

describe('createBadgeHTML', () => {
  it('does not append a question mark for low-confidence ratings', () => {
    const html = createBadgeHTML('low-confidence', ratings);
    expect(html).not.toContain('?');
  });

  it('omits unavailable individual scores', () => {
    const html = createBadgeHTML('rated', {
      ...ratings,
      rottenTomatoesScore: 'N/A',
      metacriticScore: 'N/A',
    });
    expect(html).toContain('7.8');
    expect(html).not.toContain('83%');
    expect(html).not.toContain('69');
  });

  it('falls back to N/A only when all scores are unavailable', () => {
    const html = createBadgeHTML('rated', {
      ...ratings,
      imdbRating: 'N/A',
      rottenTomatoesScore: 'N/A',
      metacriticScore: 'N/A',
    });
    expect(html).toContain('N/A');
  });
});
