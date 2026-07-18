import { useTable, useValue } from 'tinybase/ui-react';

import { BiomarkerMetric } from '@/api/generated/wearclairAPI.schemas';
import { LATEST_TABLE } from '@/modules/band/local-store';

import { useLatestBiomarkers } from './queries/use-latest-biomarkers';
import { METRIC_ORDER } from './utils';

export interface Reading {
  metric: BiomarkerMetric;
  value: number;
}

// local-first live vitals: on-device readings take priority, falling back to the
// last-synced backend values. also reports the band's connected state.
export const useLiveReadings = (): { connected: boolean; readings: Reading[] } => {
  const connected = Boolean(useValue('connected'));
  const localLatest = useTable(LATEST_TABLE);
  const latest = useLatestBiomarkers();

  const readings = METRIC_ORDER.map((metric) => {
    const local = localLatest[metric];

    if (local) {
      return { metric, value: Number(local.value) };
    }

    const remote = latest.data?.readings.find((r) => r.metric === metric);

    return remote ? { metric, value: remote.value } : null;
  }).filter((r): r is Reading => r !== null);

  return { connected, readings };
};
