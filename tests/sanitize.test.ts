import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeAttr, sanitizeHttpsUrl, sanitizeImdbId } from '../lib/sanitize';

describe('sanitize helpers', () => {
  it('escapes html-special characters', () => {
    const input = '<img src=x onerror=alert(1)>&"';
    expect(escapeHtml(input)).toBe('&lt;img src=x onerror=alert(1)&gt;&amp;&quot;');
  });

  it('escapes attribute quotes', () => {
    expect(escapeAttr("O'Reilly")).toBe('O&#39;Reilly');
  });

  it('allows only https urls', () => {
    expect(sanitizeHttpsUrl('https://m.media-amazon.com/x.jpg')).toBe('https://m.media-amazon.com/x.jpg');
    expect(sanitizeHttpsUrl('http://example.com/x.jpg')).toBeNull();
    expect(sanitizeHttpsUrl('javascript:alert(1)')).toBeNull();
  });

  it('validates imdb ids', () => {
    expect(sanitizeImdbId('tt1375666')).toBe('tt1375666');
    expect(sanitizeImdbId(' tt1375666 ')).toBe('tt1375666');
    expect(sanitizeImdbId('tt12<script>')).toBeNull();
  });
});
