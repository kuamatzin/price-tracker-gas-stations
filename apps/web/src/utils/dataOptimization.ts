/**
 * Data optimization utilities for chart performance
 */
import { ChartDataPoint, ComparisonDataPoint } from '../types/charts';

export interface DecimationOptions {
  threshold: number; // Number of points to trigger decimation
  method: 'lttb' | 'linear' | 'adaptive';
  preserveExtremes?: boolean;
}

/**
 * Largest-Triangle-Three-Buckets decimation algorithm
 * Preserves visual fidelity while reducing dataset size
 */
export const decimateDataLTTB = (
  data: ChartDataPoint[],
  targetPoints: number
): ChartDataPoint[] => {
  if (data.length <= targetPoints) return data;
  if (targetPoints < 3) return data.slice(0, targetPoints);

  const decimatedData: ChartDataPoint[] = [];
  const bucketSize = (data.length - 2) / (targetPoints - 2);

  // Always keep first point
  decimatedData.push(data[0]);

  let a = 0;
  for (let i = 0; i < targetPoints - 2; i++) {
    // Calculate the average point of the next bucket for line area calculation
    let avgX = 0;
    let avgY = 0;
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);

    const avgRangeLength = avgRangeEnd - avgRangeStart;
    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += new Date(data[j].date).getTime();
      avgY += data[j].value;
    }

    if (avgRangeLength > 0) {
      avgX /= avgRangeLength;
      avgY /= avgRangeLength;
    }

    // Get the range for this bucket
    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.min(Math.floor((i + 1) * bucketSize) + 1, data.length);

    // Point A (previous selected point)
    const pointAX = a > 0 ? new Date(data[a].date).getTime() : 0;
    const pointAY = a > 0 ? data[a].value : 0;

    let maxArea = -1;
    let maxAreaPoint = rangeOffs;

    for (let j = rangeOffs; j < rangeTo; j++) {
      const pointX = new Date(data[j].date).getTime();
      const pointY = data[j].value;

      // Calculate triangle area
      const area = Math.abs(
        (pointAX - avgX) * (pointY - pointAY) - (pointAX - pointX) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = j;
      }
    }

    decimatedData.push(data[maxAreaPoint]);
    a = maxAreaPoint;
  }

  // Always keep last point
  decimatedData.push(data[data.length - 1]);

  return decimatedData;
};

/**
 * Adaptive decimation based on data variance
 */
export const decimateDataAdaptive = (
  data: ChartDataPoint[],
  targetPoints: number,
  varianceThreshold: number = 0.1
): ChartDataPoint[] => {
  if (data.length <= targetPoints) return data;

  const decimatedData: ChartDataPoint[] = [];
  let lastSelected = data[0];
  decimatedData.push(lastSelected);

  const step = Math.max(1, Math.floor(data.length / targetPoints));
  let i = 1;

  while (i < data.length - 1) {
    const current = data[i];
    const variance = Math.abs(current.value - lastSelected.value) / lastSelected.value;

    if (variance > varianceThreshold || (i % step === 0)) {
      decimatedData.push(current);
      lastSelected = current;
    }
    i++;
  }

  // Always include last point
  decimatedData.push(data[data.length - 1]);

  return decimatedData;
};

/**
 * Linear decimation - evenly spaced points
 */
export const decimateDataLinear = (
  data: ChartDataPoint[],
  targetPoints: number
): ChartDataPoint[] => {
  if (data.length <= targetPoints) return data;

  const decimatedData: ChartDataPoint[] = [];
  const step = (data.length - 1) / (targetPoints - 1);

  for (let i = 0; i < targetPoints; i++) {
    const index = Math.round(i * step);
    if (index < data.length) {
      decimatedData.push(data[index]);
    }
  }

  return decimatedData;
};

/**
 * Main decimation function with configurable options
 */
export const decimateChartData = (
  data: ChartDataPoint[],
  options: DecimationOptions
): ChartDataPoint[] => {
  if (data.length <= options.threshold) {
    return data;
  }

  const targetPoints = Math.min(options.threshold, Math.max(50, options.threshold * 0.8));

  switch (options.method) {
    case 'lttb':
      return decimateDataLTTB(data, targetPoints);
    case 'adaptive':
      return decimateDataAdaptive(data, targetPoints);
    case 'linear':
      return decimateDataLinear(data, targetPoints);
    default:
      return decimateDataLTTB(data, targetPoints);
  }
};

/**
 * Decimation for comparison data (multi-series)
 */
export const decimateComparisonData = (
  data: ComparisonDataPoint[],
  options: DecimationOptions
): ComparisonDataPoint[] => {
  if (data.length <= options.threshold) {
    return data;
  }

  const targetPoints = Math.min(options.threshold, Math.max(50, options.threshold * 0.8));

  // Convert to ChartDataPoint for decimation, then back
  const mainSeriesData: ChartDataPoint[] = data.map(point => ({
    date: point.date,
    value: point.currentStation
  }));

  const decimatedIndices = new Set<number>();
  const decimatedMainSeries = decimateDataLTTB(mainSeriesData, targetPoints);

  // Find original indices of decimated points
  decimatedMainSeries.forEach(point => {
    const originalIndex = data.findIndex(d => 
      d.date === point.date && d.currentStation === point.value
    );
    if (originalIndex !== -1) {
      decimatedIndices.add(originalIndex);
    }
  });

  // Return comparison data points at decimated indices
  return Array.from(decimatedIndices)
    .sort((a, b) => a - b)
    .map(index => data[index]);
};

/**
 * Calculate optimal decimation threshold based on screen width
 */
export const calculateOptimalThreshold = (screenWidth: number): number => {
  // Aim for roughly 2-4 pixels per data point
  const pixelsPerPoint = 3;
  return Math.floor(screenWidth / pixelsPerPoint);
};

/**
 * Check if data needs decimation
 */
export const shouldDecimateData = (
  dataLength: number,
  threshold: number
): boolean => {
  return dataLength > threshold;
};