import { subDays } from 'date-fns';

export const CHART_CONFIG = {
  colors: {
    regular: '#10B981', // Green
    premium: '#F59E0B', // Amber
    diesel: '#3B82F6', // Blue
    market: '#6B7280', // Gray
    positive: '#10B981', // Green for positive
    negative: '#EF4444', // Red for negative
  },
  animations: {
    duration: 300,
    easing: 'ease-in-out',
  },
  margins: {
    top: 20,
    right: 30,
    bottom: 40,
    left: 60,
  },
  responsive: {
    mobile: { height: 300 },
    tablet: { height: 400 },
    desktop: { height: 500 },
  },
} as const;

export const DATE_PRESETS = {
  '7d': {
    label: '7 días',
    getDates: () => ({
      startDate: subDays(new Date(), 7),
      endDate: new Date(),
    }),
  },
  '15d': {
    label: '15 días',
    getDates: () => ({
      startDate: subDays(new Date(), 15),
      endDate: new Date(),
    }),
  },
  '30d': {
    label: '30 días',
    getDates: () => ({
      startDate: subDays(new Date(), 30),
      endDate: new Date(),
    }),
  },
} as const;

export const FUEL_TYPES = {
  regular: {
    label: 'Magna',
    color: CHART_CONFIG.colors.regular,
  },
  premium: {
    label: 'Premium',
    color: CHART_CONFIG.colors.premium,
  },
  diesel: {
    label: 'Diésel',
    color: CHART_CONFIG.colors.diesel,
  },
} as const;