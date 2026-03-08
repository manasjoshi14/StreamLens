# StreamLens

Browser extension for Chrome and Safari that overlays IMDb, Rotten Tomatoes, and Metacritic ratings on supported streaming platforms. Click any badge to open a review panel with TMDB user reviews.

## Supported providers

- Netflix browse and search pages
- Prime Video browse, search, and detail surfaces on `primevideo.com`
- JioHotstar browse, search, and detail surfaces on `hotstar.com`

> StreamLens depends on the live DOM of each streaming provider. Providers can change their markup at any time, which may require selector updates or provider-specific maintenance.

## Installation

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Free API keys:
  - [OMDb API](https://www.omdbapi.com/apikey.aspx)
  - [TMDB API](https://www.themoviedb.org/settings/api) (optional, used for review previews)

### Setup

```bash
git clone https://github.com/manasjoshi14/StreamLens.git && cd StreamLens
pnpm install
pnpm build
```

### Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `.output/chrome-mv3/`
5. Open a supported streaming site and enter your API keys from the extension popup

### Safari

```bash
./scripts/build-safari.sh
```

After the app launches:
1. Safari -> Settings -> **Extensions** -> enable **StreamLens**
2. Grant permissions when prompted
3. Open a supported streaming site and enter your API keys from the extension popup

## Development

```bash
pnpm dev
pnpm test
```

## Architecture

- Shared content core handles tile observation, badge rendering, review panel behavior, and background messaging.
- Provider registry resolves the active streaming provider from the current site.
- Provider modules own page gating, selectors, title extraction, detail-surface extraction, and badge anchor heuristics.
- Background service worker, cache, and API clients remain shared across providers.
