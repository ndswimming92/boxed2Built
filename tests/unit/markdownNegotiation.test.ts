import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokens, markdownPathFor, prefersMarkdown } from '../../cloudflare/markdownNegotiation.ts';

test('agents that ask for markdown get it', () => {
  assert.equal(prefersMarkdown('text/markdown'), true);
  assert.equal(prefersMarkdown('Text/Markdown; charset=utf-8'), true);
  assert.equal(prefersMarkdown('text/markdown, text/html;q=0.9, */*;q=0.1'), true);
  assert.equal(prefersMarkdown('text/html, text/markdown'), true);
});

test('browsers and everything else keep getting HTML', () => {
  const chrome = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
  assert.equal(prefersMarkdown(chrome), false);
  assert.equal(prefersMarkdown('*/*'), false);
  assert.equal(prefersMarkdown('text/*'), false);
  assert.equal(prefersMarkdown(''), false);
  assert.equal(prefersMarkdown(null), false);
});

test('markdown listed below HTML, or refused, is not served', () => {
  assert.equal(prefersMarkdown('text/html, text/markdown;q=0.5'), false);
  assert.equal(prefersMarkdown('text/markdown;q=0'), false);
  assert.equal(prefersMarkdown('text/markdown;q=nonsense'), false);
});

test('a page URL maps to the .md file written beside its .html', () => {
  assert.equal(markdownPathFor('/'), '/index.md');
  assert.equal(markdownPathFor('/index.html'), '/index.md');
  assert.equal(markdownPathFor('/about'), '/about.md');
  assert.equal(markdownPathFor('/about/'), '/about.md');
  assert.equal(markdownPathFor('/about.html'), '/about.md');
  assert.equal(markdownPathFor('/services/tv-mounting/'), '/services/tv-mounting.md');
});

test('files are left alone', () => {
  assert.equal(markdownPathFor('/robots.txt'), null);
  assert.equal(markdownPathFor('/about.md'), null);
  assert.equal(markdownPathFor('/images/photo.webp'), null);
});

test('token estimate is about a quarter of the size', () => {
  assert.equal(estimateTokens(4000), 1000);
  assert.equal(estimateTokens(1), 1);
});
