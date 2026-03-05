import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: 'StreamLens',
    description: 'IMDB & Rotten Tomatoes ratings on Netflix tiles',
    version: '1.0.0',
    permissions: ['storage'],
    host_permissions: [
      'https://www.omdbapi.com/*',
      'https://api.themoviedb.org/*',
    ],
  },
  webExt: {
    startUrls: ['https://www.netflix.com/browse'],
  },
});
