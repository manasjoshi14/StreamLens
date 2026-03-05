export const SELECTORS = {
  titleCard: '[data-uia="title-card"]',
  searchCard: '[data-uia="search-gallery-video-card"]',
  titleLink: 'a[href*="/title/"]',
  sliderItem: '.slider-item',
  titleText: [
    'a[aria-label]',
    'img[alt]',
    '.fallback-text',
  ],
  lolomoRow: '.lolomoRow, .rowContainer',
} as const;

export function queryTitleText(element: Element): string | null {
  // Check element's own aria-label first (search cards often have it)
  const ownLabel = element.getAttribute('aria-label');
  if (ownLabel) return ownLabel;

  // Check child elements
  for (const selector of SELECTORS.titleText) {
    const el = element.querySelector(selector);
    if (!el) continue;

    if (selector === 'a[aria-label]') {
      return el.getAttribute('aria-label');
    }
    if (selector === 'img[alt]') {
      return el.getAttribute('alt');
    }
    return el.textContent?.trim() || null;
  }

  // Fallback: any nested element with aria-label
  const labeled = element.querySelector('[aria-label]');
  if (labeled) return labeled.getAttribute('aria-label');

  // Fallback: any img with alt
  const img = element.querySelector('img[alt]');
  if (img) return img.getAttribute('alt');

  return null;
}

export function extractNetflixId(element: Element): string | null {
  const link = element.querySelector(SELECTORS.titleLink);
  if (!link) return null;
  const href = link.getAttribute('href') || '';
  const match = href.match(/\/title\/(\d+)/);
  return match ? match[1] : null;
}
