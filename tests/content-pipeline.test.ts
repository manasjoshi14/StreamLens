import { describe, it, expect } from 'vitest';
import { queryTitleText, extractNetflixId, SELECTORS } from '../entrypoints/netflix.content/selectors';
import { findUnprocessedTiles, markProcessed, isProcessed } from '../entrypoints/netflix.content/tile-detector';
import { extractTileInfo } from '../entrypoints/netflix.content/title-extractor';

type FakeElement = {
  getAttribute?: (name: string) => string | null;
  querySelector?: (selector: string) => any;
  querySelectorAll?: (selector: string) => any[];
  hasAttribute?: (name: string) => boolean;
  setAttribute?: (name: string, value: string) => void;
  textContent?: string | null;
};

function createAttrElement(initial: Record<string, string> = {}): FakeElement {
  const attrs = new Map(Object.entries(initial));
  return {
    getAttribute: (name: string) => attrs.get(name) ?? null,
    hasAttribute: (name: string) => attrs.has(name),
    setAttribute: (name: string, value: string) => {
      attrs.set(name, value);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

describe('selectors', () => {
  it('reads title from element aria-label first', () => {
    const element = {
      getAttribute: (name: string) => (name === 'aria-label' ? 'Arcane' : null),
      querySelector: () => null,
    } as FakeElement;

    expect(queryTitleText(element as unknown as Element)).toBe('Arcane');
  });

  it('extracts netflix id from title link', () => {
    const link = { getAttribute: (name: string) => (name === 'href' ? '/title/70143836' : null) };
    const element = { querySelector: () => link } as FakeElement;

    expect(extractNetflixId(element as unknown as Element)).toBe('70143836');
  });
});

describe('tile detector', () => {
  it('finds unique unprocessed tiles across selector strategies', () => {
    const tileA = createAttrElement();
    const tileB = createAttrElement();
    tileB.setAttribute?.('data-nfr-processed', 'true');

    const root = {
      querySelectorAll: (selector: string) => {
        if (selector === SELECTORS.titleCard) return [tileA];
        if (selector === SELECTORS.searchCard) return [tileA, tileB];
        if (selector === SELECTORS.sliderItem) return [];
        return [];
      },
    } as FakeElement;

    const found = findUnprocessedTiles(root as unknown as Document);
    expect(found).toEqual([tileA as unknown as Element]);
  });

  it('marks tiles as processed', () => {
    const tile = createAttrElement();
    expect(isProcessed(tile as unknown as Element)).toBe(false);
    markProcessed(tile as unknown as Element);
    expect(isProcessed(tile as unknown as Element)).toBe(true);
  });
});

describe('title extractor', () => {
  it('extracts normalized title, year, and netflix id', () => {
    const link = { getAttribute: (name: string) => (name === 'href' ? '/title/12345678' : null) };
    const element = {
      getAttribute: (name: string) => (name === 'aria-label' ? 'The Matrix (1999)' : null),
      querySelector: (selector: string) => {
        if (selector === SELECTORS.titleLink) return link;
        return null;
      },
    } as FakeElement;

    expect(extractTileInfo(element as unknown as Element)).toEqual({
      title: 'The Matrix',
      year: '1999',
      netflixId: '12345678',
    });
  });
});
