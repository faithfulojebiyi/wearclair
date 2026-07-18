import {
  Droplets,
  Egg,
  HeartPulse,
  LucideIcon,
  Moon,
  Zap,
} from 'lucide-react-native';

// health-insight category → icon + tint, shared by the feed cards.
export const INSIGHT_CATEGORY: Record<string, { icon: LucideIcon; tint: string }> = {
  fertility: { icon: Egg, tint: '#C98B2D' },
  energy: { icon: Zap, tint: '#B4622D' },
  cycle: { icon: Droplets, tint: '#B85C6E' },
  recovery: { icon: Moon, tint: '#8A6FB8' },
  vitals: { icon: HeartPulse, tint: '#4E9B6F' },
};

// coarse "Today / Yesterday / N days ago" label for an ISO date.
export const relativeDays = (iso: string): string => {
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000),
  );

  if (days <= 0) {
    return 'Today';
  }

  return days === 1 ? 'Yesterday' : `${days} days ago`;
};
