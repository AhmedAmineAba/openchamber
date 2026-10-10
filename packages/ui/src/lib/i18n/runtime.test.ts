import { describe, expect, test } from 'bun:test';

import { getLocaleDirection, LOCALES, normalizeLocale } from './runtime';

describe('i18n runtime', () => {
  test('Arabic and Hebrew lay the app out right to left and every other locale left to right', () => {
    for (const locale of LOCALES) {
      expect(getLocaleDirection(locale)).toBe(locale === 'ar' || locale === 'he' ? 'rtl' : 'ltr');
    }
  });

  test('regional Arabic tags resolve to Arabic', () => {
    expect(normalizeLocale('ar')).toBe('ar');
    expect(normalizeLocale('ar-EG')).toBe('ar');
    expect(normalizeLocale('ar_SA')).toBe('ar');
  });

  test('Hebrew resolves from its current and its retired language code', () => {
    expect(normalizeLocale('he-IL')).toBe('he');
    expect(normalizeLocale('iw')).toBe('he');
    expect(normalizeLocale('iw-IL')).toBe('he');
  });
});
