import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: 'StreamLens',
    description: 'Ratings overlays for supported streaming platforms',
    version: '1.0.0',
    permissions: ['storage'],
    host_permissions: [
      'https://www.omdbapi.com/*',
      'https://api.themoviedb.org/*',
    ],
  },
  webExt: {
    startUrls: ['https://www.netflix.com/browse', 'https://www.primevideo.com/', 'https://www.hotstar.com/in'],
  },
});
