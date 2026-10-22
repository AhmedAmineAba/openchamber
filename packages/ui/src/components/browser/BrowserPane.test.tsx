import React from 'react';
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

const browserPaneSource = readFileSync(new URL('./BrowserPane.tsx', import.meta.url), 'utf8');

describe('BrowserPane webview', () => {
  test('emits the Electron popup presence attribute as an empty string', () => {
    const webview = browserPaneSource.match(/<webview\b[\s\S]*?\/>/)?.[0];
    expect(webview !== undefined).toBe(true);
    expect(webview?.includes("allowpopups={'' as unknown as boolean}")).toBe(true);
    expect(renderToStaticMarkup(<webview allowpopups={'' as unknown as boolean} />)).toContain('allowpopups=""');
  });
});
