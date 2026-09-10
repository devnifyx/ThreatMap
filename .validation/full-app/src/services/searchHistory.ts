type SearchHistoryItem = {
  id: string;
  query: string;
  createdAt: number;
  lastUsedAt: number;
  count: number;
};

export type SearchHistoryScope = 'scan' | 'osint';

const LEGACY_STORAGE_KEY = 'lekirrax.searchHistory.v1';
const MAX_ITEMS = 500;

export function getSearchHistoryStorageKey(scope: SearchHistoryScope = 'scan') {
  return `lekirrax.searchHistory.${scope}.v1`;
}

function safeParse(raw: string | null): SearchHistoryItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === 'object')
      .map((x) => ({
        id: String((x as any).id || ''),
        query: String((x as any).query || ''),
        createdAt: Number((x as any).createdAt || 0),
        lastUsedAt: Number((x as any).lastUsedAt || 0),
        count: Number((x as any).count || 0)
      }))
      .filter((x) => x.id && x.query && Number.isFinite(x.lastUsedAt));
  } catch {
    return [];
  }
}

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, ' ');
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadSearchHistory(scope: SearchHistoryScope = 'scan'): SearchHistoryItem[] {
  const items = safeParse(localStorage.getItem(getSearchHistoryStorageKey(scope)));
  return items.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

export function addSearchHistory(query: string, scope: SearchHistoryScope = 'scan'): SearchHistoryItem[] {
  const q = normalizeQuery(query);
  if (!q) return loadSearchHistory(scope);

  const now = Date.now();
  const items = loadSearchHistory(scope);
  const idx = items.findIndex((x) => x.query.toLowerCase() === q.toLowerCase());
  if (idx >= 0) {
    const existing = items[idx];
    const updated: SearchHistoryItem = {
      ...existing,
      query: q,
      lastUsedAt: now,
      count: (existing.count || 0) + 1
    };
    const next = [updated, ...items.slice(0, idx), ...items.slice(idx + 1)].slice(0, MAX_ITEMS);
    safeWriteToScope(next, scope);
    return next;
  }

  const next: SearchHistoryItem[] = [
    {
      id: makeId(),
      query: q,
      createdAt: now,
      lastUsedAt: now,
      count: 1
    },
    ...items
  ].slice(0, MAX_ITEMS);

  safeWriteToScope(next, scope);
  return next;
}

function safeWriteToScope(items: SearchHistoryItem[], scope: SearchHistoryScope) {
  safeWriteToKey(items, getSearchHistoryStorageKey(scope));
}

function safeWriteToKey(items: SearchHistoryItem[], key: string) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    void e;
  }
}

export function removeSearchHistoryItem(id: string, scope: SearchHistoryScope = 'scan'): SearchHistoryItem[] {
  const items = loadSearchHistory(scope);
  const next = items.filter((x) => x.id !== id);
  safeWriteToScope(next, scope);
  return next;
}

export function clearSearchHistory(scope: SearchHistoryScope = 'scan'): void {
  try {
    localStorage.removeItem(getSearchHistoryStorageKey(scope));
    if (scope === 'scan') {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch (e) {
    void e;
  }
}

export type SearchHistorySort = 'recent' | 'oldest' | 'alpha';

export function querySearchHistory(params: { text?: string; sort?: SearchHistorySort; limit?: number; scope?: SearchHistoryScope }) {
  const sort = params.sort || 'recent';
  const text = (params.text || '').trim().toLowerCase();
  const limit = params.limit ?? 50;
  const scope = params.scope || 'scan';

  let items = loadSearchHistory(scope);
  if (text) {
    items = items.filter((x) => x.query.toLowerCase().includes(text));
  }

  if (sort === 'oldest') items = items.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
  if (sort === 'alpha') items = items.sort((a, b) => a.query.localeCompare(b.query));

  return items.slice(0, Math.max(0, limit));
}
