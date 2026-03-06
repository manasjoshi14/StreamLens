import { LEVENSHTEIN_CONFIDENCE_THRESHOLD, MIN_TITLE_MATCH_THRESHOLD } from '../../lib/constants';

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}

export function similarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();

  if (la === lb) return 1;

  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;

  const dist = levenshteinDistance(la, lb);
  return 1 - dist / maxLen;
}

export function isLowConfidence(queryTitle: string, resultTitle: string): boolean {
  return similarity(queryTitle, resultTitle) < LEVENSHTEIN_CONFIDENCE_THRESHOLD;
}

export interface SearchResult {
  title: string;
  year: string;
  imdbId: string;
  type: string;
}

export function pickBestMatch(query: string, queryYear: string | undefined, results: SearchResult[]): SearchResult | null {
  if (results.length === 0) return null;

  let best: SearchResult | null = null;
  let bestScore = -1;

  for (const result of results) {
    let score = similarity(query, result.title);

    if (queryYear && result.year) {
      const yearDiff = Math.abs(parseInt(queryYear) - parseInt(result.year));
      if (yearDiff === 0) score += 0.2;
      else if (yearDiff === 1) score += 0.1;
      else score -= yearDiff * 0.05;
    }

    if (score > bestScore) {
      bestScore = score;
      best = result;
    }
  }

  if (!best || bestScore < MIN_TITLE_MATCH_THRESHOLD) {
    return null;
  }

  return best;
}
