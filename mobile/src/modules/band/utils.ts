// fine-grained "Ns / N min / N h ago" for recent sync timestamps (millis).
export const relativeTimeMs = (ms: number): string => {
  const seconds = Math.round((Date.now() - ms) / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);

  return minutes < 60
    ? `${minutes} min ago`
    : `${Math.round(minutes / 60)} h ago`;
};
