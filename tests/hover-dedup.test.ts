import { describe, it, expect, beforeEach } from 'vitest';
import { processedMap, makeDedupeKey, isDuplicate } from '../entrypoints/streaming.content/hover-injector';
import type { DetailInfo } from '../lib/types';

beforeEach(() => {
  processedMap.clear();
});

function detail(overrides: Partial<DetailInfo> = {}): DetailInfo {
  return {
    title: 'Raazi',
    context: 'hover',
    ...overrides,
  };
}

describe('makeDedupeKey', () => {
  it('includes provider and context with normalized title', () => {
    expect(makeDedupeKey('netflix', detail())).toBe('netflix:hover:raazi');
  });

  it('falls back to content ID when title is unavailable', () => {
    expect(makeDedupeKey('prime', { contentId: 'amzn1.dv.gti.123', context: 'detail', title: '' })).toBe('prime:detail:amzn1.dv.gti.123');
  });

  it('returns null when both title and content ID are missing', () => {
    expect(makeDedupeKey('prime', { title: '' })).toBeNull();
  });

  it('keeps different contexts independent', () => {
    expect(makeDedupeKey('netflix', detail({ context: 'hover' }))).toBe('netflix:hover:raazi');
    expect(makeDedupeKey('netflix', detail({ context: 'jbv' }))).toBe('netflix:jbv:raazi');
  });
});

describe('isDuplicate', () => {
  it('returns false for unseen keys', () => {
    expect(isDuplicate('netflix:hover:123', 1200)).toBe(false);
  });

  it('returns true within cooldown window', () => {
    processedMap.set('netflix:hover:raazi', Date.now());
    expect(isDuplicate('netflix:hover:raazi', 1200)).toBe(true);
  });

  it('returns false after cooldown expires', () => {
    processedMap.set('netflix:hover:raazi', Date.now() - 1500);
    expect(isDuplicate('netflix:hover:raazi', 1200)).toBe(false);
  });
});
