import {
  Activity,
  Droplets,
  Gauge,
  HeartPulse,
  LucideIcon,
  Move,
  Radio,
  Thermometer,
  Waves,
  Wind,
  Zap,
} from 'lucide-react-native';

import {
  BiomarkerMetric,
  SeriesBucket,
} from '@/api/generated/wearclairAPI.schemas';
import { metricMeta } from '@/ui/theme/theme';

export const HOUR_MS = 60 * 60 * 1000;

// each range reads the bucket tier that serves it: 6h off the raw hypertable at
// 5-minute grain, 7d the hourly rollup, 30/60d the daily rollup.
export const RANGES = [
  { key: '6h', label: '6H', hours: 6, bucket: SeriesBucket['5m'] },
  { key: '7d', label: '7D', hours: 7 * 24, bucket: SeriesBucket['1h'] },
  { key: '30d', label: '30D', hours: 30 * 24, bucket: SeriesBucket['1d'] },
  { key: '60d', label: '60D', hours: 60 * 24, bucket: SeriesBucket['1d'] },
] as const;

export type Range = (typeof RANGES)[number];
export type RangeKey = Range['key'];

export const METRIC_ORDER = Object.keys(metricMeta) as BiomarkerMetric[];

export const METRIC_ICONS: Record<BiomarkerMetric, LucideIcon> = {
  skin_temp: Thermometer,
  heart_rate: HeartPulse,
  hrv: Activity,
  respiratory_rate: Wind,
  eda: Zap,
  arterial_stiffness: Waves,
  perfusion_index: Droplets,
  spo2: Gauge,
  bioimpedance: Radio,
  motion_index: Move,
};

// x-axis label for a chart bucket: date for daily tiers, time-of-day otherwise.
export const formatSeriesLabel = (iso: string, bucket: SeriesBucket): string => {
  const date = new Date(iso);

  if (bucket === SeriesBucket['1d']) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
};
