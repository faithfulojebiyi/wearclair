import { sampleVitals } from './band-sim';
import { recordVitals, store } from './local-store';

// the "BLE connection". While connected, the band streams one reading per sensor
// every EMIT_MS into the local store — exactly what a real always-on wearable does.
const EMIT_MS = 3000;

let timer: ReturnType<typeof setInterval> | null = null;

const emit = (userId: string) => {
  const now = Date.now();
  recordVitals(now, sampleVitals(userId, new Date(now)));
};

export const connectBand = (userId: string): void => {
  if (timer) {
    return;
  }

  store.setValue('connected', true);
  emit(userId); // first reading immediately on connect

  timer = setInterval(() => emit(userId), EMIT_MS);
};

export const disconnectBand = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  store.setValue('connected', false);
};
