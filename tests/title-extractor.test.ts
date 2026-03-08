import { describe, it, expect } from 'vitest';
import { normalizeTitleText } from '../entrypoints/streaming.content/providers/shared';

describe('normalizeTitleText', () => {
  it('extracts release year in parentheses', () => {
    expect(normalizeTitleText('Inception (2010)')).toEqual({ title: 'Inception', year: '2010' });
  });

  it('strips season suffixes from series titles', () => {
    expect(normalizeTitleText('Dark: Season 1')).toEqual({ title: 'Dark' });
  });

  it('strips volume and part suffixes', () => {
    expect(normalizeTitleText('Lupin: Part 2')).toEqual({ title: 'Lupin' });
    expect(normalizeTitleText('Money Heist: Volume 1')).toEqual({ title: 'Money Heist' });
  });
});
