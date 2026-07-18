import { useValue } from 'tinybase/ui-react';

import { store } from '@/modules/band/local-store';

import { Category, CATALOG_BY_KEY, DEFAULT_ORDER } from './catalog';

// Track-screen prefs (which categories are shown + their order) persist in the same
// TinyBase store as vitals, so they survive restarts cross-platform. Stored as JSON
// strings under two values.
const HIDDEN_KEY = 'cycle_hidden';
const ORDER_KEY = 'cycle_order';

const parse = (raw: unknown): string[] => {
  if (typeof raw !== 'string' || raw.length === 0) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

const readHidden = (): string[] => parse(store.getValue(HIDDEN_KEY));

const readOrder = (): string[] => {
  const saved = parse(store.getValue(ORDER_KEY));
  // keep saved order, then append any catalog keys added since (new categories)
  const merged = [...saved.filter((k) => k in CATALOG_BY_KEY)];

  for (const key of DEFAULT_ORDER) {
    if (!merged.includes(key)) {
      merged.push(key);
    }
  }

  return merged;
};

export const setHidden = (keys: string[]): void => {
  store.setValue(HIDDEN_KEY, JSON.stringify(keys));
};

export const toggleHidden = (key: string): void => {
  const hidden = readHidden();

  setHidden(
    hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key],
  );
};

export const setOrder = (keys: string[]): void => {
  store.setValue(ORDER_KEY, JSON.stringify(keys));
};

// move a category up (dir -1) or down (dir +1) in the saved order
export const moveCategory = (key: string, dir: -1 | 1): void => {
  const order = readOrder();
  const idx = order.indexOf(key);
  const next = idx + dir;

  if (idx === -1 || next < 0 || next >= order.length) {
    return;
  }

  [order[idx], order[next]] = [order[next], order[idx]];
  setOrder(order);
};

// reactive: ordered categories in their saved order (all of them, incl. hidden)
export const useOrderedCategories = (): Category[] => {
  useValue(ORDER_KEY);

  return readOrder().map((key) => CATALOG_BY_KEY[key]).filter(Boolean);
};

// reactive: only the visible categories, in order — drives the Track screen
export const useVisibleCategories = (): Category[] => {
  useValue(ORDER_KEY);
  useValue(HIDDEN_KEY);

  const hidden = new Set(readHidden());

  return readOrder()
    .map((key) => CATALOG_BY_KEY[key])
    .filter((cat) => cat && !hidden.has(cat.key));
};

export const useHiddenSet = (): Set<string> => {
  useValue(HIDDEN_KEY);

  return new Set(readHidden());
};
