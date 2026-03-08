import type { RatingsData, ReviewsData, DailyCounter } from './types';

export type Message =
  | { type: 'GET_RATINGS'; payload: { providerId: string; title: string; year?: string; contentId?: string } }
  | { type: 'GET_REVIEWS'; payload: { title: string; imdbId?: string; mediaType?: 'movie' | 'series' } }
  | { type: 'CLEAR_CACHE' }
  | { type: 'GET_STATS' };

export type MessageResponse =
  | { type: 'RATINGS'; data: RatingsData | null; status?: 'ok' | 'no-match' | 'rate-limited' | 'error'; error?: string }
  | { type: 'REVIEWS'; data: ReviewsData | null; error?: string }
  | { type: 'CACHE_CLEARED' }
  | { type: 'STATS'; data: { cacheEntries: number; dailyCounter: DailyCounter } };
