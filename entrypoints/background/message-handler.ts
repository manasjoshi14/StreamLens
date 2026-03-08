import type { Message, MessageResponse } from '../../lib/messages';
import { fetchRatings, fetchReviews } from './api-client';
import { getCacheKey, getRating, setRating, getCacheStats, clearAllCache, getNoMatchFull, setNoMatch } from './cache';
import { getDailyCounter } from '../../lib/storage';

const pendingRequests = new Map<string, Promise<MessageResponse>>();

export function handleMessage(
  message: Message,
  _sender: unknown,
  sendResponse: (response: MessageResponse) => void,
): true {
  processMessage(message)
    .then(sendResponse)
    .catch((err) => {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.debug('[NFR] message handler error:', message.type, errorMsg);
      sendResponse(buildErrorResponse(message, errorMsg));
    });
  return true;
}

function buildErrorResponse(message: Message, errorMsg: string): MessageResponse {
  switch (message.type) {
    case 'GET_REVIEWS':
      return { type: 'REVIEWS', data: null, error: errorMsg };
    case 'GET_STATS':
      return {
        type: 'STATS',
        data: {
          cacheEntries: 0,
          dailyCounter: { date: new Date().toISOString().split('T')[0], omdbCalls: 0 },
        },
      };
    case 'CLEAR_CACHE':
      return { type: 'CACHE_CLEARED' };
    default:
      return { type: 'RATINGS', data: null, status: 'error', error: errorMsg };
  }
}

async function processMessage(message: Message): Promise<MessageResponse> {
  switch (message.type) {
    case 'GET_RATINGS':
      return handleGetRatings(message.payload);
    case 'GET_REVIEWS':
      return handleGetReviews(message.payload);
    case 'CLEAR_CACHE':
      await clearAllCache();
      return { type: 'CACHE_CLEARED' };
    case 'GET_STATS': {
      const cacheEntries = await getCacheStats();
      const dailyCounter = await getDailyCounter();
      return { type: 'STATS', data: { cacheEntries, dailyCounter } };
    }
    default:
      return { type: 'RATINGS', data: null, error: 'Unknown message type' };
  }
}

async function handleGetRatings(
  payload: { providerId: string; title: string; year?: string; contentId?: string }
): Promise<MessageResponse> {
  const key = getCacheKey(payload.providerId, payload.contentId, payload.title, payload.year);

  const cached = await getRating(key);
  if (cached) {
    console.debug('[NFR] cache hit:', key);
    return { type: 'RATINGS', data: cached, status: 'ok' };
  }

  const noMatch = await getNoMatchFull(key);
  if (noMatch) {
    console.debug('[NFR] no-match cache hit:', key);
    return { type: 'RATINGS', data: null, status: 'no-match' };
  }

  const existing = pendingRequests.get(key);
  if (existing) {
    return existing;
  }

  const promise = (async (): Promise<MessageResponse> => {
    try {
      console.debug('[NFR] API fetch:', payload.title, payload.year || '');
      const data = await fetchRatings(payload.title, payload.year);
      if (data) {
        await setRating(key, data);

        if (payload.contentId) {
          const titleKey = getCacheKey(payload.providerId, undefined, payload.title, payload.year);
          await setRating(titleKey, data);
        }

        console.debug('[NFR] API result: ok for', payload.title);
        return { type: 'RATINGS', data, status: 'ok' };
      }
      console.debug('[NFR] API result: no match for', payload.title);
      await setNoMatch(key);
      if (payload.contentId) {
        const titleKey = getCacheKey(payload.providerId, undefined, payload.title, payload.year);
        await setNoMatch(titleKey);
      }
      return { type: 'RATINGS', data: null, status: 'no-match' };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      if (errorMsg === 'rate-limited') {
        console.debug('[NFR] rate-limited for', payload.title);
        return { type: 'RATINGS', data: null, status: 'rate-limited', error: errorMsg };
      }
      console.debug('[NFR] error for', payload.title, errorMsg);
      return { type: 'RATINGS', data: null, status: 'error', error: errorMsg };
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, promise);
  return promise;
}

async function handleGetReviews(
  payload: { title: string; imdbId?: string; mediaType?: 'movie' | 'series' }
): Promise<MessageResponse> {
  try {
    if (!payload.imdbId) {
      return { type: 'REVIEWS', data: { reviews: [], totalResults: 0 } };
    }

    const data = await fetchReviews(payload.imdbId, payload.mediaType || 'movie');
    return { type: 'REVIEWS', data };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return { type: 'REVIEWS', data: null, error: errorMsg };
  }
}
