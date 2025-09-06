import { CHART_CONFIG } from './charts';

export const chartTheme = {
  axis: {
    stroke: '#E5E7EB', // gray-200
    strokeWidth: 1,
    fontSize: 12,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
  grid: {
    stroke: '#F3F4F6', // gray-100
    strokeWidth: 1,
    strokeDasharray: '2 2',
  },
  tooltip: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '0.5rem',
    padding: '0.75rem',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    fontSize: '0.875rem',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
  legend: {
    fontSize: 12,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    color: '#374151', // gray-700
  },
  line: {
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    dot: {
      strokeWidth: 2,
      r: 4,
    },
    activeDot: {
      strokeWidth: 2,
      r: 6,
    },
  },
  area: {
    strokeWidth: 2,
    fillOpacity: 0.1,
  },
  colors: CHART_CONFIG.colors,
  margins: CHART_CONFIG.margins,
} as const;

export const darkChartTheme = {
  ...chartTheme,
  axis: {
    ...chartTheme.axis,
    stroke: '#374151', // gray-700
  },
  grid: {
    ...chartTheme.grid,
    stroke: '#4B5563', // gray-600
  },
  tooltip: {
    ...chartTheme.tooltip,
    backgroundColor: '#1F2937', // gray-800
    border: '1px solid #374151', // gray-700
    color: '#F9FAFB', // gray-50
  },
  legend: {
    ...chartTheme.legend,
    color: '#D1D5DB', // gray-300
  },
} as const;

export const getChartTheme = (isDark: boolean = false) => 
  isDark ? darkChartTheme : chartTheme;