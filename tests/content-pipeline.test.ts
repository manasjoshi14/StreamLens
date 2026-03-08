import { describe, it, expect } from 'vitest';
import { jioHotstarProvider } from '../entrypoints/streaming.content/providers/jiohotstar';
import { netflixProvider } from '../entrypoints/streaming.content/providers/netflix';
import { primeProvider } from '../entrypoints/streaming.content/providers/prime';
import { findProviderTiles, findUnprocessedTiles, markProcessed, isProcessed } from '../entrypoints/streaming.content/tile-detector';

type FakeElement = {
  matches?: (selector: string) => boolean;
  closest?: (selector: string) => any;
  getAttribute?: (name: string) => string | null;
  getBoundingClientRect?: () => { width: number; height: number };
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
    matches: () => false,
    closest: () => null,
    getBoundingClientRect: () => ({ width: 0, height: 0 }),
  };
}

describe('tile detector', () => {
  it('finds unique unprocessed tiles across selector strategies', () => {
    const tileA = createAttrElement();
    const tileB = createAttrElement();
    tileB.setAttribute?.('data-nfr-processed', 'true');

    const root = {
      querySelectorAll: (selector: string) => {
        if (selector === netflixProvider.tileSelectors[0]) return [tileA];
        if (selector === netflixProvider.tileSelectors[1]) return [tileA, tileB];
        return [];
      },
    } as FakeElement;

    const found = findUnprocessedTiles(netflixProvider.tileSelectors, root as unknown as Document);
    expect(found).toEqual([tileA as unknown as Element]);
  });

  it('marks tiles as processed', () => {
    const tile = createAttrElement();
    expect(isProcessed(tile as unknown as Element)).toBe(false);
    markProcessed(tile as unknown as Element);
    expect(isProcessed(tile as unknown as Element)).toBe(true);
  });
});

describe('netflix provider', () => {
  it('extracts normalized title, year, and content ID', () => {
    const link = { getAttribute: (name: string) => (name === 'href' ? '/title/12345678' : null) };
    const element = {
      getAttribute: (name: string) => (name === 'aria-label' ? 'The Matrix (1999)' : null),
      querySelector: (selector: string) => {
        if (selector === 'a[href*="/title/"]') return link;
        return null;
      },
    } as FakeElement;

    expect(netflixProvider.extractTileInfo(element as unknown as Element)).toEqual({
      title: 'The Matrix',
      year: '1999',
      contentId: '12345678',
    });
  });

  it('matches browse and search pages only', () => {
    expect(netflixProvider.isActivePage({ pathname: '/browse' } as Location)).toBe(true);
    expect(netflixProvider.isActivePage({ pathname: '/search/foo' } as Location)).toBe(true);
    expect(netflixProvider.isActivePage({ pathname: '/title/123' } as Location)).toBe(false);
  });
});

describe('prime provider', () => {
  it('extracts title and content ID from detail links', () => {
    const link = {
      matches: (selector: string) => selector === 'a[href*="/detail/"]',
      getAttribute: (name: string) => {
        if (name === 'href') return '/detail/amzn1.dv.gti.123456789';
        if (name === 'aria-label') return 'The Boys (2019)';
        return null;
      },
      querySelector: () => null,
    } as FakeElement;

    expect(primeProvider.extractTileInfo(link as unknown as Element)).toEqual({
      title: 'The Boys',
      year: '2019',
      contentId: 'amzn1.dv.gti.123456789',
    });
  });

  it('extracts detail title from hero content', () => {
    const hero = {
      getAttribute: () => null,
      querySelector: (selector: string) => {
        if (selector === '[data-card-title]') return null;
        if (selector === '[aria-label]') return null;
        if (selector === 'img[alt]') return { getAttribute: () => 'Reacher' };
        return null;
      },
    } as FakeElement;

    expect(primeProvider.extractDetailInfo(hero as unknown as Element)).toEqual({
      title: 'Reacher',
      contentId: undefined,
      context: 'detail',
    });
  });

  it('treats browse and detail pages as active but skips watch pages', () => {
    expect(primeProvider.isActivePage({ pathname: '/storefront/home' } as Location)).toBe(true);
    expect(primeProvider.isActivePage({ pathname: '/detail/amzn1.dv.gti.123' } as Location)).toBe(true);
    expect(primeProvider.isActivePage({ pathname: '/watch' } as Location)).toBe(false);
  });
});

describe('jiohotstar provider', () => {
  it('extracts title, year, and content ID from movie links', () => {
    const image = {
      getAttribute: (name: string) => (name === 'alt' ? 'Special Ops (2024)' : null),
      getBoundingClientRect: () => ({ width: 180, height: 260 }),
    };
    const link = {
      matches: (selector: string) => selector === 'a[href]',
      getAttribute: (name: string) => {
        if (name === 'href') return '/movies/special-ops-2024/1260167890';
        if (name === 'aria-label') return 'Special Ops (2024)';
        return null;
      },
      querySelector: (selector: string) => (selector === 'img' || selector === 'img[alt]' ? image : null),
    } as FakeElement;

    expect(jioHotstarProvider.extractTileInfo(link as unknown as Element)).toEqual({
      title: 'Special Ops',
      year: '2024',
      contentId: '1260167890',
    });
  });

  it('extracts detail title from image alt text', () => {
    const hero = {
      getAttribute: () => null,
      querySelector: (selector: string) => {
        if (selector === '[data-title]') return null;
        if (selector === '[aria-label]') return null;
        if (selector === 'img[alt]') return { getAttribute: () => 'Criminal Justice' };
        return null;
      },
    } as FakeElement;

    expect(jioHotstarProvider.extractDetailInfo(hero as unknown as Element)).toEqual({
      title: 'Criminal Justice',
      contentId: undefined,
      context: 'detail',
    });
  });

  it('returns home-page action cards and rejects channels', () => {
    const posterImage = {
      getBoundingClientRect: () => ({ width: 180, height: 260 }),
      getAttribute: (name: string) => (name === 'alt' ? 'Murder Report' : null),
    };
    const posterCard = {
      getAttribute: (name: string) => {
        if (name === 'aria-label') return 'Murder Report,Show';
        return null;
      },
      getBoundingClientRect: () => ({ width: 180, height: 260 }),
      hasAttribute: () => false,
      closest: () => null,
      querySelector: (selector: string) => {
        if (selector === 'img' || selector === 'img[alt]') return posterImage;
        if (selector === 'article') return { getBoundingClientRect: () => ({ width: 180, height: 260 }) };
        return null;
      },
    } as FakeElement;
    const channelCard = {
      getAttribute: (name: string) => (name === 'aria-label' ? 'StarPlus,CHANNEL' : null),
      getBoundingClientRect: () => ({ width: 32, height: 32 }),
      hasAttribute: () => false,
      closest: () => true,
      querySelector: () => ({ getBoundingClientRect: () => ({ width: 24, height: 24 }), getAttribute: () => '' }),
    } as FakeElement;

    const root = {
      querySelectorAll: (selector: string) => {
        if (selector.includes('[data-testid="action"][aria-label]')) return [posterCard, channelCard];
        if (selector === 'a[href]') return [];
        return [];
      },
    } as FakeElement;

    const found = findProviderTiles(jioHotstarProvider, root as unknown as Document);
    expect(found).toEqual([posterCard as unknown as Element]);
  });

  it('extracts title from hotstar home action cards without links', () => {
    const image = {
      getAttribute: (name: string) => (name === 'alt' ? 'Tulsa King' : null),
      getBoundingClientRect: () => ({ width: 180, height: 260 }),
    };
    const actionCard = {
      getAttribute: (name: string) => {
        if (name === 'aria-label') return 'Tulsa King,Show';
        return null;
      },
      getBoundingClientRect: () => ({ width: 180, height: 260 }),
      querySelector: (selector: string) => {
        if (selector === 'img' || selector === 'img[alt]') return image;
        if (selector === 'a[href]') return null;
        return null;
      },
    } as FakeElement;

    expect(jioHotstarProvider.extractTileInfo(actionCard as unknown as Element)).toEqual({
      title: 'Tulsa King',
      year: undefined,
      contentId: undefined,
    });
  });

  it('matches hotstar browse and detail pages but skips watch pages', () => {
    expect(jioHotstarProvider.isActivePage({ pathname: '/in/home' } as Location)).toBe(true);
    expect(jioHotstarProvider.isActivePage({ pathname: '/movies/foo/1260' } as Location)).toBe(true);
    expect(jioHotstarProvider.isActivePage({ pathname: '/watch/1260' } as Location)).toBe(false);
  });
});
