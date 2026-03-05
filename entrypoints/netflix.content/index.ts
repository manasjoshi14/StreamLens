import { createTileObserver, findUnprocessedTiles } from './tile-detector';
import { extractTileInfo } from './title-extractor';
import { injectBadge, updateBadge } from './overlay-injector';
import { openPanel, setupPanelKeyboard } from './review-panel';
import { createHoverObserver } from './hover-injector';
import { SCROLL_DEBOUNCE_MS, INTERSECTION_ROOT_MARGIN } from '../../lib/constants';
import type { RatingsData } from '../../lib/types';
import type { Message, MessageResponse } from '../../lib/messages';
import { isSetupComplete, isEnabled } from '../../lib/storage';

export default defineContentScript({
  matches: ['*://*.netflix.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',
  css: ['./style.css'],

  async main(ctx) {
    const ready = await isSetupComplete();
    const enabled = await isEnabled();
    if (!ready || !enabled) return;

    if (!isActivePage()) return;

    setupPanelKeyboard();
    const hoverObserver = createHoverObserver();

    const visibleTiles = new Set<Element>();
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingFetch = false;

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleTiles.add(entry.target);
          } else {
            visibleTiles.delete(entry.target);
          }
        }
        scheduleScrollFetch();
      },
      { rootMargin: INTERSECTION_ROOT_MARGIN }
    );

    function scheduleScrollFetch(): void {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (visibleTiles.size > 0 && !pendingFetch) {
          fetchVisibleTiles();
        }
      }, SCROLL_DEBOUNCE_MS);
    }

    async function fetchVisibleTiles(): Promise<void> {
      pendingFetch = true;
      const tiles = Array.from(visibleTiles);

      await Promise.all(tiles.map(tile => fetchRatingForTile(tile)));
      pendingFetch = false;
    }

    async function fetchRatingForTile(tile: Element): Promise<void> {
      const info = extractTileInfo(tile);
      if (!info) {
        updateBadge(tile, 'na');
        return;
      }

      console.debug('[NFR] tile:', info.title, info.year || '', info.netflixId || '');

      try {
        const message: Message = {
          type: 'GET_RATINGS',
          payload: {
            title: info.title,
            year: info.year,
            netflixId: info.netflixId,
          },
        };

        const response = await browser.runtime.sendMessage(message) as MessageResponse;

        if (response.type === 'RATINGS') {
          if (response.data) {
            const state = response.data.lowConfidence ? 'low-confidence' : 'rated';
            console.debug('[NFR] tile result:', info.title, state);
            updateBadge(tile, state, response.data, handleBadgeClick);
          } else if (response.status === 'rate-limited') {
            console.debug('[NFR] tile result:', info.title, 'rate-limited');
            updateBadge(tile, 'rate-limited');
          } else if (response.status === 'no-match') {
            console.debug('[NFR] tile result:', info.title, 'no-match');
            updateBadge(tile, 'na');
          } else if (response.status === 'error') {
            console.debug('[NFR] tile result:', info.title, 'error', response.error);
            updateBadge(tile, 'error');
          } else {
            updateBadge(tile, 'na');
          }
        }
      } catch (err) {
        console.debug('[NFR] tile fetch error:', info.title, err);
        updateBadge(tile, 'error');
      }
    }

    function handleBadgeClick(data: RatingsData): void {
      openPanel(data);
    }

    function processTiles(tiles: Element[]): void {
      for (const tile of tiles) {
        injectBadge(tile, 'loading');
        intersectionObserver.observe(tile);
      }
    }

    const initialTiles = findUnprocessedTiles();
    if (initialTiles.length > 0) {
      processTiles(initialTiles);
    }

    createTileObserver((tiles) => {
      processTiles(tiles);
    });

    ctx.addEventListener(window, 'wxt:locationchange' as any, () => {
      if (isActivePage()) {
        setTimeout(() => {
          const tiles = findUnprocessedTiles();
          if (tiles.length > 0) {
            processTiles(tiles);
          }
        }, 500);
      }
    });

    ctx.onInvalidated(() => {
      intersectionObserver.disconnect();
      hoverObserver.disconnect();
    });
  },
});

function isActivePage(): boolean {
  const path = window.location.pathname;
  return path === '/browse' || path.startsWith('/search');
}
