export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const LRU_MAX_ENTRIES = 500;
export const DAILY_LIMIT = 1000;
export const DAILY_WARNING = 900;
export const SCROLL_DEBOUNCE_MS = 500;
export const MUTATION_DEBOUNCE_MS = 150;
export const INTERSECTION_ROOT_MARGIN = '200px';
export const LEVENSHTEIN_CONFIDENCE_THRESHOLD = 0.8;
export const MAX_REVIEWS = 10;
export const REVIEW_PREVIEW_LENGTH = 200;
export const PANEL_WIDTH = 400;

export const OMDB_BASE_URL = 'https://www.omdbapi.com/';
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export const STORAGE_KEYS = {
  omdbApiKey: 'omdbApiKey',
  tmdbApiKey: 'tmdbApiKey',
  enabled: 'enabled',
  dailyCounter: 'dailyCounter',
  cache: 'ratingsCache',
  setupComplete: 'setupComplete',
} as const;
