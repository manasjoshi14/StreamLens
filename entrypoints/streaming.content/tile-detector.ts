import type { StreamingProvider } from '../../lib/types';

const PROCESSED_ATTR = 'data-nfr-processed';

export function findUnprocessedTiles(selectors: readonly string[], root: Element | Document = document): Element[] {
  const seen = new Set<Element>();

  for (const selector of selectors) {
    root.querySelectorAll(selector).forEach(tile => {
      if (!tile.hasAttribute(PROCESSED_ATTR) && !seen.has(tile)) {
        seen.add(tile);
      }
    });
  }

  return Array.from(seen);
}

export function findProviderTiles(provider: StreamingProvider, root: Element | Document = document): Element[] {
  if (provider.findTileElements) {
    return provider.findTileElements(root).filter(tile => !tile.hasAttribute(PROCESSED_ATTR));
  }
  return findUnprocessedTiles(provider.tileSelectors, root);
}

export function markProcessed(tile: Element): void {
  tile.setAttribute(PROCESSED_ATTR, 'true');
}

export function isProcessed(tile: Element): boolean {
  return tile.hasAttribute(PROCESSED_ATTR);
}

export function createTileObserver(
  provider: StreamingProvider,
  debounceMs: number,
  callback: (tiles: Element[]) => void
): MutationObserver {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const tiles = findProviderTiles(provider);
      if (tiles.length > 0) {
        callback(tiles);
      }
    }, debounceMs);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}
