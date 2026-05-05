import { describe, expect, it } from 'vitest';
import { toSlug } from '../src/lib/slug';

describe('toSlug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(toSlug('Müller AG')).toBe('mueller-ag');
  });

  it('transliterates German umlauts and ß', () => {
    expect(toSlug('Größe Süß GmbH')).toBe('groesse-suess-gmbh');
  });

  it('strips disallowed characters', () => {
    expect(toSlug('Kunde & Co. (CH)')).toBe('kunde-co-ch');
  });

  it('collapses repeated separators and trims', () => {
    expect(toSlug('  Hello   World  ')).toBe('hello-world');
    expect(toSlug('---a---b---')).toBe('a-b');
  });

  it('returns "tenant" for inputs that slug to empty string', () => {
    expect(toSlug('')).toBe('tenant');
    expect(toSlug('!!!')).toBe('tenant');
  });

  it('caps slug length at 60 characters', () => {
    const long = 'a'.repeat(100);
    expect(toSlug(long)).toHaveLength(60);
  });
});
