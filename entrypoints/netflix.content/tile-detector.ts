import { SELECTORS } from './selectors';
import { MUTATION_DEBOUNCE_MS } from '../../lib/constants';

const PROCESSED_ATTR = 'data-nfr-processed';

export function findUnprocessedTiles(root: Element | Document = document): Element[] {
  const seen = new Set<Element>();

  const strategies = [
    SELECTORS.titleCard,
    SELECTORS.searchCard,
    SELECTORS.sliderItem,
  ];

  for (const selector of strategies) {
    root.querySelectorAll(selector).forEach(tile => {
      if (!tile.hasAttribute(PROCESSED_ATTR) && !seen.has(tile)) {
        seen.add(tile);
      }
    });
  }

  return Array.from(seen);
}

export function markProcessed(tile: Element): void {
  tile.setAttribute(PROCESSED_ATTR, 'true');
}

export function isProcessed(tile: Element): boolean {
  return tile.hasAttribute(PROCESSED_ATTR);
}

export function createTileObserver(callback: (tiles: Element[]) => void): MutationObserver {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const tiles = findUnprocessedTiles();
      if (tiles.length > 0) {
        callback(tiles);
      }
    }, MUTATION_DEBOUNCE_MS);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}
