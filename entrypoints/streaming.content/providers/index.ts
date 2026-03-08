import type { StreamingProvider } from '../../../lib/types';
import { jioHotstarProvider } from './jiohotstar';
import { netflixProvider } from './netflix';
import { primeProvider } from './prime';

export const PROVIDERS: StreamingProvider[] = [netflixProvider, primeProvider, jioHotstarProvider];
export const SUPPORTED_MATCHES = PROVIDERS.flatMap(provider => provider.matches);

export function getActiveProvider(location: Location = window.location): StreamingProvider | null {
  const host = location.hostname.toLowerCase();
  return PROVIDERS.find(provider => {
    if (provider.id === 'netflix') return host.endsWith('netflix.com');
    if (provider.id === 'prime') return host.endsWith('primevideo.com');
    if (provider.id === 'jiohotstar') return host.endsWith('hotstar.com');
    return false;
  }) || null;
}
