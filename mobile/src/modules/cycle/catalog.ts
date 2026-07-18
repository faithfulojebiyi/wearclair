import {
  Activity,
  ArrowUpDown,
  BookOpen,
  CircleDot,
  Droplet,
  Droplets,
  FlaskConical,
  Hand,
  Heart,
  HeartPulse,
  LucideIcon,
  Pill,
  Smile,
  Tag,
  TestTube,
  Zap,
} from 'lucide-react-native';

// the single source of truth for the Track ("Add note") screen and the More
// Parameters screen. `key` is the CycleLog.type stored on the backend (validated by
// the matching zod enum in apps/api/.../cycle/schema.ts). value encoding:
//   multi/list → comma-joined option keys · single → one option key · diary → free text
export type CategoryKind = 'multi' | 'single' | 'diary' | 'list';

export interface Category {
  key: string;
  label: string;
  icon: LucideIcon;
  tint: string;
  kind: CategoryKind;
  options?: string[];
}

export const CATALOG: Category[] = [
  {
    key: 'flow',
    label: 'Flow',
    icon: Droplet,
    tint: '#EE7A36',
    kind: 'multi',
    options: ['Spotting', 'Light', 'Medium', 'Heavy'],
  },
  {
    key: 'symptom',
    label: 'Symptoms',
    icon: Activity,
    tint: '#B85C6E',
    kind: 'multi',
    options: [
      'Cramps',
      'Headache',
      'Tender breasts',
      'Bloating',
      'Acne',
      'Backache',
      'Nausea',
      'Fatigue',
      'Cravings',
      'Insomnia',
    ],
  },
  {
    key: 'mood',
    label: 'Moods',
    icon: Smile,
    tint: '#8A6FB8',
    kind: 'multi',
    options: [
      'Calm',
      'Happy',
      'Energetic',
      'Irritable',
      'Anxious',
      'Sad',
      'Sensitive',
      'Angry',
    ],
  },
  {
    key: 'sex',
    label: 'Sex life',
    icon: Heart,
    tint: '#C96F8A',
    kind: 'multi',
    options: [
      'None',
      'Protected',
      'Unprotected',
      'High drive',
      'Neutral',
      'Low drive',
      'Masturbation',
      'Orgasm',
    ],
  },
  {
    key: 'cervical_mucus',
    label: 'Cervical mucus',
    icon: Droplets,
    tint: '#5B8FC9',
    kind: 'single',
    options: ['Dry', 'Sticky', 'Creamy', 'Egg white', 'Watery', 'Spotting'],
  },
  {
    key: 'cervix_position',
    label: 'Cervix position',
    icon: ArrowUpDown,
    tint: '#4E9B6F',
    kind: 'single',
    options: ['Low', 'Medium', 'High'],
  },
  {
    key: 'cervix_status',
    label: 'Cervix status',
    icon: CircleDot,
    tint: '#4E9B6F',
    kind: 'single',
    options: ['Closed', 'Medium', 'Open'],
  },
  {
    key: 'cervix_texture',
    label: 'Cervix texture',
    icon: Hand,
    tint: '#4E9B6F',
    kind: 'single',
    options: ['Firm', 'Medium', 'Soft'],
  },
  {
    key: 'ovulation_test',
    label: 'Ovulation test',
    icon: TestTube,
    tint: '#C98B2D',
    kind: 'single',
    options: ['Positive', 'Negative', 'Not taken'],
  },
  {
    key: 'pregnancy_test',
    label: 'Pregnancy test',
    icon: FlaskConical,
    tint: '#C98B2D',
    kind: 'single',
    options: ['Positive', 'Negative', 'Not taken'],
  },
  {
    key: 'breast_exam',
    label: 'Breast self-exam',
    icon: HeartPulse,
    tint: '#B85C6E',
    kind: 'single',
    options: ['Normal', 'Lumps', 'Pain', 'Discharge'],
  },
  {
    key: 'medicine',
    label: 'Medicine',
    icon: Pill,
    tint: '#5B8FC9',
    kind: 'list',
  },
  {
    key: 'energy',
    label: 'Energy',
    icon: Zap,
    tint: '#B4622D',
    kind: 'single',
    options: ['Exhausted', 'Tired', 'OK', 'Energetic', 'Very energetic'],
  },
  {
    key: 'diary',
    label: 'Diary',
    icon: BookOpen,
    tint: '#62636C',
    kind: 'diary',
  },
  {
    key: 'tag',
    label: 'Tags',
    icon: Tag,
    tint: '#8B8D98',
    kind: 'list',
  },
];

export const CATALOG_BY_KEY: Record<string, Category> = Object.fromEntries(
  CATALOG.map((cat) => [cat.key, cat]),
);

export const DEFAULT_ORDER = CATALOG.map((cat) => cat.key);

// split/join helpers for the comma-joined value encoding
export const splitValue = (value: string | undefined): string[] =>
  value ? value.split(',').map((v) => v.trim()).filter(Boolean) : [];

export const joinValue = (items: string[]): string => items.join(', ');
