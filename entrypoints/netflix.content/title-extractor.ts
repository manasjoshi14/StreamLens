import type { TileInfo } from '../../lib/types';
import { queryTitleText, extractNetflixId } from './selectors';

const SUFFIX_PATTERNS = [
  /:\s*Season\s+\d+$/i,
  /:\s*Volume\s+\d+$/i,
  /:\s*Limited Series$/i,
  /:\s*Part\s+\d+$/i,
  /\s*\(Season\s+\d+\)$/i,
  /\s*\(Volume\s+\d+\)$/i,
];

const YEAR_PATTERN = /\((\d{4})\)/;

export function normalizeTitleText(raw: string): { title: string; year?: string } {
  let title = raw.trim();
  let year: string | undefined;

  const yearMatch = title.match(YEAR_PATTERN);
  if (yearMatch) {
    year = yearMatch[1];
    title = title.replace(YEAR_PATTERN, '').trim();
  }

  for (const pattern of SUFFIX_PATTERNS) {
    title = title.replace(pattern, '').trim();
  }

  return { title, year };
}

export function extractTileInfo(element: Element): TileInfo | null {
  const rawText = queryTitleText(element);
  if (!rawText) return null;

  const { title, year } = normalizeTitleText(rawText);
  if (!title) return null;

  const netflixId = extractNetflixId(element);

  return {
    title,
    year,
    netflixId: netflixId ?? undefined,
  };
}
