import type { RatingsData, ReviewsData, Review } from '../../lib/types';
import { OMDB_BASE_URL, TMDB_BASE_URL, DAILY_LIMIT } from '../../lib/constants';
import { getApiKeys, getDailyCounter, incrementDailyCounter } from '../../lib/storage';
import { isLowConfidence, pickBestMatch, type SearchResult } from './title-matcher';

interface OmdbResponse {
  Response: string;
  Title?: string;
  Year?: string;
  imdbRating?: string;
  imdbID?: string;
  Metascore?: string;
  Plot?: string;
  Genre?: string;
  Poster?: string;
  Type?: string;
  Rated?: string;
  Runtime?: string;
  Actors?: string;
  Director?: string;
  Ratings?: Array<{ Source: string; Value: string }>;
  Error?: string;
  Search?: Array<{
    Title: string;
    Year: string;
    imdbID: string;
    Type: string;
  }>;
}

function checkOmdbError(data: OmdbResponse): void {
  if (data.Response === 'False' && data.Error) {
    const err = data.Error.toLowerCase();
    if (err.includes('limit') || err.includes('rate') || err.includes('quota')) {
      throw new Error('rate-limited');
    }
    if (err.includes('invalid api key')) {
      throw new Error('OMDb API key invalid');
    }
  }
}

function extractRtScore(ratings?: Array<{ Source: string; Value: string }>): string {
  if (!ratings) return 'N/A';
  const rt = ratings.find(r => r.Source === 'Rotten Tomatoes');
  if (!rt) return 'N/A';
  return rt.Value.replace('%', '');
}

function mapOmdbToRatings(omdb: OmdbResponse, queryTitle: string, lowConfidence: boolean): RatingsData {
  return {
    title: omdb.Title || queryTitle,
    year: omdb.Year || 'N/A',
    imdbRating: omdb.imdbRating || 'N/A',
    imdbId: omdb.imdbID || '',
    rottenTomatoesScore: extractRtScore(omdb.Ratings),
    metacriticScore: omdb.Metascore || 'N/A',
    plot: omdb.Plot || 'N/A',
    genre: omdb.Genre || 'N/A',
    poster: omdb.Poster || 'N/A',
    type: (omdb.Type === 'series' ? 'series' : 'movie') as 'movie' | 'series',
    rated: omdb.Rated || 'N/A',
    runtime: omdb.Runtime || 'N/A',
    actors: omdb.Actors || 'N/A',
    director: omdb.Director || 'N/A',
    lowConfidence,
  };
}

export async function fetchRatings(title: string, year?: string): Promise<RatingsData | null> {
  const { omdbKey } = await getApiKeys();
  if (!omdbKey) throw new Error('OMDb API key not configured');

  const counter = await getDailyCounter();
  if (counter.omdbCalls >= DAILY_LIMIT) {
    throw new Error('rate-limited');
  }

  // Try exact match first
  const params = new URLSearchParams({ t: title, apikey: omdbKey });
  if (year) params.set('y', year);

  await incrementDailyCounter();
  const response = await fetch(`${OMDB_BASE_URL}?${params}`);
  const data: OmdbResponse = await response.json();

  checkOmdbError(data);

  if (data.Response === 'True' && data.Title) {
    const lowConf = isLowConfidence(title, data.Title);
    return mapOmdbToRatings(data, title, lowConf);
  }

  // Fallback: search
  const searchCounter = await getDailyCounter();
  if (searchCounter.omdbCalls >= DAILY_LIMIT) {
    throw new Error('rate-limited');
  }

  const searchParams = new URLSearchParams({ s: title, apikey: omdbKey });
  if (year) searchParams.set('y', year);

  await incrementDailyCounter();
  const searchResponse = await fetch(`${OMDB_BASE_URL}?${searchParams}`);
  const searchData: OmdbResponse = await searchResponse.json();

  checkOmdbError(searchData);

  if (searchData.Response !== 'True' || !searchData.Search?.length) {
    return null;
  }

  const results: SearchResult[] = searchData.Search.map(s => ({
    title: s.Title,
    year: s.Year,
    imdbId: s.imdbID,
    type: s.Type,
  }));

  const best = pickBestMatch(title, year, results);
  if (!best) return null;

  // Fetch full details for the best match
  const detailCounter = await getDailyCounter();
  if (detailCounter.omdbCalls >= DAILY_LIMIT) {
    throw new Error('rate-limited');
  }

  await incrementDailyCounter();
  const detailResponse = await fetch(`${OMDB_BASE_URL}?${new URLSearchParams({ i: best.imdbId, apikey: omdbKey })}`);
  const detailData: OmdbResponse = await detailResponse.json();

  checkOmdbError(detailData);

  if (detailData.Response === 'True' && detailData.Title) {
    const lowConf = isLowConfidence(title, detailData.Title);
    return mapOmdbToRatings(detailData, title, lowConf);
  }

  return null;
}

export async function fetchReviews(imdbId: string, mediaType: 'movie' | 'series'): Promise<ReviewsData> {
  const { tmdbKey } = await getApiKeys();
  if (!tmdbKey) throw new Error('TMDB API key not configured');

  // Find TMDB ID from IMDB ID
  const findResponse = await fetch(
    `${TMDB_BASE_URL}/find/${imdbId}?api_key=${tmdbKey}&external_source=imdb_id`
  );
  const findData = await findResponse.json();

  let tmdbId: number | null = null;
  let resolvedType: 'movie' | 'tv' = mediaType === 'series' ? 'tv' : 'movie';

  if (resolvedType === 'movie' && findData.movie_results?.length > 0) {
    tmdbId = findData.movie_results[0].id;
  } else if (resolvedType === 'tv' && findData.tv_results?.length > 0) {
    tmdbId = findData.tv_results[0].id;
  } else if (findData.movie_results?.length > 0) {
    tmdbId = findData.movie_results[0].id;
    resolvedType = 'movie';
  } else if (findData.tv_results?.length > 0) {
    tmdbId = findData.tv_results[0].id;
    resolvedType = 'tv';
  }

  if (!tmdbId) {
    return { reviews: [], totalResults: 0 };
  }

  const reviewsResponse = await fetch(
    `${TMDB_BASE_URL}/${resolvedType}/${tmdbId}/reviews?api_key=${tmdbKey}`
  );
  const reviewsData = await reviewsResponse.json();

  const reviews: Review[] = (reviewsData.results || []).map((r: any) => ({
    author: r.author || 'Anonymous',
    content: r.content || '',
    rating: r.author_details?.rating ?? null,
    url: r.url || '',
    createdAt: r.created_at || '',
  }));

  return {
    reviews,
    totalResults: reviewsData.total_results || 0,
  };
}
