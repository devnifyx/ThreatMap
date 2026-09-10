import { describe, it, expect, beforeEach } from 'vitest';
import {
  addSearchHistory,
  clearSearchHistory,
  loadSearchHistory,
  querySearchHistory,
  removeSearchHistoryItem
} from '../searchHistory';

describe('searchHistory', () => {
  beforeEach(() => {
    clearSearchHistory();
    clearSearchHistory('osint');
  });

  it('adds and loads items', () => {
    addSearchHistory('example.com');
    const items = loadSearchHistory();
    expect(items.length).toBe(1);
    expect(items[0].query).toBe('example.com');
  });

  it('dedupes by query and increments count', () => {
    addSearchHistory('Example.com');
    addSearchHistory('example.com');
    const items = loadSearchHistory();
    expect(items.length).toBe(1);
    expect(items[0].count).toBe(2);
  });

  it('filters and sorts', () => {
    addSearchHistory('b.com');
    addSearchHistory('a.com');
    const alpha = querySearchHistory({ sort: 'alpha' });
    expect(alpha[0].query).toBe('a.com');
  });

  it('removes an item', () => {
    const items = addSearchHistory('example.com');
    removeSearchHistoryItem(items[0].id);
    expect(loadSearchHistory().length).toBe(0);
  });

  it('separates scan and osint history buckets', () => {
    addSearchHistory('example.com', 'scan');
    addSearchHistory('student@example.com', 'osint');

    expect(loadSearchHistory('scan').map((item) => item.query)).toEqual(['example.com']);
    expect(loadSearchHistory('osint').map((item) => item.query)).toEqual(['student@example.com']);
    expect(querySearchHistory({ scope: 'scan' }).map((item) => item.query)).toEqual(['example.com']);
  });
});
