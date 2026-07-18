import { useQuery } from '@tanstack/react-query';

import { biomarkersControllerGetSeries } from '@/api/generated/biomarkers/biomarkers';
import { BiomarkerMetric } from '@/api/generated/wearclairAPI.schemas';

import { HOUR_MS, Range } from '../utils';

// bucketed time series for one metric over a range (the Perform chart).
export const useBiomarkerSeries = (metric: BiomarkerMetric, range: Range) =>
  useQuery({
    queryKey: ['biomarkers', 'series', metric, range.key],
    queryFn: () =>
      biomarkersControllerGetSeries({
        metric,
        bucket: range.bucket,
        from: new Date(Date.now() - range.hours * HOUR_MS).toISOString(),
        to: new Date().toISOString(),
      }),
  });
