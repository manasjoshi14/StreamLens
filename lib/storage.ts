import { STORAGE_KEYS } from './constants';
import type { DailyCounter } from './types';

export async function getApiKeys(): Promise<{ omdbKey: string; tmdbKey: string }> {
  const result = await browser.storage.local.get([
    STORAGE_KEYS.omdbApiKey,
    STORAGE_KEYS.tmdbApiKey,
  ]);

  return {
    omdbKey: result[STORAGE_KEYS.omdbApiKey] || import.meta.env.VITE_OMDB_API_KEY || '',
    tmdbKey: result[STORAGE_KEYS.tmdbApiKey] || import.meta.env.VITE_TMDB_API_KEY || '',
  };
}

export async function setApiKeys(omdbKey: string, tmdbKey: string): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.omdbApiKey]: omdbKey,
    [STORAGE_KEYS.tmdbApiKey]: tmdbKey,
  });
}

export async function isEnabled(): Promise<boolean> {
  const result = await browser.storage.local.get(STORAGE_KEYS.enabled);
  return result[STORAGE_KEYS.enabled] !== false;
}

export async function setEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.enabled]: enabled });
}

export async function isSetupComplete(): Promise<boolean> {
  const { omdbKey } = await getApiKeys();
  return omdbKey.length > 0;
}

export async function getDailyCounter(): Promise<DailyCounter> {
  const result = await browser.storage.local.get(STORAGE_KEYS.dailyCounter);
  const counter = result[STORAGE_KEYS.dailyCounter] as DailyCounter | undefined;
  const today = new Date().toISOString().split('T')[0];

  if (!counter || counter.date !== today) {
    return { date: today, omdbCalls: 0 };
  }
  return counter;
}

export async function incrementDailyCounter(): Promise<DailyCounter> {
  const counter = await getDailyCounter();
  counter.omdbCalls++;
  await browser.storage.local.set({ [STORAGE_KEYS.dailyCounter]: counter });
  return counter;
}
