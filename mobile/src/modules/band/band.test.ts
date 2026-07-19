/// <reference types="bun" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { connectBand, disconnectBand } from './band';
import { clearAllLocalData, getQueued, store } from './local-store';

// fast emit interval so tests observe real timer behavior
const TEST_EMIT_MS = 10;

describe('band stream vs account cleanup', () => {
  beforeEach(() => {
    disconnectBand();
    clearAllLocalData();
  });

  afterEach(() => {
    disconnectBand();
  });

  it('streams into the queue while connected', async () => {
    connectBand('user-a', TEST_EMIT_MS);

    // immediate first emit on connect
    expect(getQueued().length).toBeGreaterThan(0);
    expect(store.getValue('connected')).toBe(true);

    const afterConnect = getQueued().length;
    await Bun.sleep(TEST_EMIT_MS * 4);

    expect(getQueued().length).toBeGreaterThan(afterConnect);
  });

  it('reconnect works even after a store wipe that skipped disconnect', async () => {
    connectBand('user-a', TEST_EMIT_MS);

    // account-change claim path: wipes the store but the interval survives
    clearAllLocalData();
    expect(store.getValue('connected')).toBe(false);

    // the wedge: connect must restart the stale timer, not early-return
    connectBand('user-b', TEST_EMIT_MS);

    expect(store.getValue('connected')).toBe(true);

    const afterConnect = getQueued().length;
    await Bun.sleep(TEST_EMIT_MS * 4);

    expect(getQueued().length).toBeGreaterThan(afterConnect);
  });

  it('sign-out cleanup stops the stream so the wiped queue stays empty', async () => {
    connectBand('user-a', TEST_EMIT_MS);
    await Bun.sleep(TEST_EMIT_MS * 3);
    expect(getQueued().length).toBeGreaterThan(0);

    // the performSignOut order: stop the stream FIRST, then wipe
    disconnectBand();
    clearAllLocalData();

    await Bun.sleep(TEST_EMIT_MS * 4);

    expect(getQueued().length).toBe(0);
    expect(store.getValue('connected')).toBe(false);
  });
});
