export interface RatingsData {
  title: string;
  year: string;
  imdbRating: string;
  imdbId: string;
  rottenTomatoesScore: string;
  metacriticScore: string;
  plot: string;
  genre: string;
  poster: string;
  type: 'movie' | 'series';
  rated: string;
  runtime: string;
  actors: string;
  director: string;
  lowConfidence: boolean;
}

export interface Review {
  author: string;
  content: string;
  rating: number | null;
  url: string;
  createdAt: string;
}

export interface ReviewsData {
  reviews: Review[];
  totalResults: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface NoMatchEntry {
  noMatch: true;
  timestamp: number;
}

export interface DailyCounter {
  date: string;
  omdbCalls: number;
}

export type BadgeState = 'loading' | 'rated' | 'na' | 'low-confidence' | 'error' | 'rate-limited';

export interface TileInfo {
  title: string;
  year?: string;
  contentId?: string;
}

export interface DetailInfo {
  title: string;
  contentId?: string;
  context?: string;
}

export interface StreamingProvider {
  id: string;
  label: string;
  matches: string[];
  tileSelectors: readonly string[];
  detailSelectors: readonly string[];
  isActivePage(location: Location): boolean;
  findTileElements?(root: Element | Document): Element[];
  extractTileInfo(element: Element): TileInfo | null;
  extractDetailInfo(element: Element): DetailInfo | null;
  findDetailBadgeAnchor(element: Element): Element | null;
  getDetailCooldownMs?(detail: DetailInfo): number;
}
