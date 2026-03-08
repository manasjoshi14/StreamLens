import { createTileObserver, findProviderTiles } from './tile-detector';
import { injectBadge, updateBadge } from './overlay-injector';
import { openPanel, setupPanelKeyboard } from './review-panel';
import { createHoverObserver } from './hover-injector';
import './style.css';
import { SCROLL_DEBOUNCE_MS, INTERSECTION_ROOT_MARGIN, MUTATION_DEBOUNCE_MS } from '../../lib/constants';
import type { RatingsData } from '../../lib/types';
import type { Message, MessageResponse } from '../../lib/messages';
import { isSetupComplete, isEnabled } from '../../lib/storage';
import { getActiveProvider, SUPPORTED_MATCHES } from './providers';

export default defineContentScript({
  matches: SUPPORTED_MATCHES,
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',

  async main(ctx) {
    const ready = await isSetupComplete();
    const enabled = await isEnabled();
    const provider = getActiveProvider(window.location);

    if (!ready || !enabled || !provider || !provider.isActivePage(window.location)) return;

    setupPanelKeyboard();
    const hoverObserver = createHoverObserver(provider);

    const visibleTiles = new Set<Element>();
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingFetch = false;

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visibleTiles.add(entry.target);
          else visibleTiles.delete(entry.target);
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
      try {
        const staleTiles = Array.from(visibleTiles).filter(tile => !(tile as HTMLElement).isConnected);
        for (const stale of staleTiles) visibleTiles.delete(stale);

        const tiles = Array.from(visibleTiles);
        await Promise.all(tiles.map(tile => fetchRatingForTile(tile)));
      } finally {
        pendingFetch = false;
      }
    }

    async function fetchRatingForTile(tile: Element): Promise<void> {
      const info = provider.extractTileInfo(tile);
      if (!info) {
        updateBadge(tile, 'na');
        return;
      }

      try {
        const message: Message = {
          type: 'GET_RATINGS',
          payload: {
            providerId: provider.id,
            title: info.title,
            year: info.year,
            contentId: info.contentId,
          },
        };

        const response = await browser.runtime.sendMessage(message) as MessageResponse;

        if (response.type === 'RATINGS') {
          if (response.data) {
            const state = response.data.lowConfidence ? 'low-confidence' : 'rated';
            updateBadge(tile, state, response.data, handleBadgeClick);
          } else if (response.status === 'rate-limited') {
            updateBadge(tile, 'rate-limited');
          } else if (response.status === 'error') {
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

    const initialTiles = findProviderTiles(provider);
    if (initialTiles.length > 0) processTiles(initialTiles);

    const tileObserver = createTileObserver(provider, MUTATION_DEBOUNCE_MS, (tiles) => {
      processTiles(tiles);
    });

    ctx.addEventListener(window, 'wxt:locationchange' as any, () => {
      const nextProvider = getActiveProvider(window.location);
      if (!nextProvider || nextProvider.id !== provider.id || !nextProvider.isActivePage(window.location)) return;

      setTimeout(() => {
        const tiles = findProviderTiles(nextProvider);
        if (tiles.length > 0) processTiles(tiles);
      }, 500);
    });

    ctx.onInvalidated(() => {
      if (scrollTimer) clearTimeout(scrollTimer);
      visibleTiles.clear();
      tileObserver.disconnect();
      intersectionObserver.disconnect();
      hoverObserver.disconnect();
    });
  },
});
