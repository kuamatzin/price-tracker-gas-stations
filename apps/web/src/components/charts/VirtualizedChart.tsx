import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChartDataPoint } from '../../types/analytics';

export interface VirtualizedChartProps {
  data: ChartDataPoint[];
  children: (visibleData: ChartDataPoint[], startIndex: number, endIndex: number) => React.ReactNode;
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Virtualized chart container for handling large datasets
 * Only renders visible data points to improve performance
 */
export const VirtualizedChart: React.FC<VirtualizedChartProps> = ({
  data,
  children,
  itemHeight = 300,
  containerHeight = 400,
  overscan = 5,
  timeRange
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter data by time range if provided
  const filteredData = useMemo(() => {
    if (!timeRange) return data;

    return data.filter(point => {
      const pointDate = new Date(point.date);
      return pointDate >= timeRange.start && pointDate <= timeRange.end;
    });
  }, [data, timeRange]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      filteredData.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, overscan, filteredData.length]);

  // Get visible data slice
  const visibleData = useMemo(() => {
    return filteredData.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [filteredData, visibleRange]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Calculate total height for scrollbar
  const totalHeight = filteredData.length * itemHeight;

  return (
    <div
      ref={containerRef}
      className="virtualized-chart-container"
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: totalHeight,
          position: 'relative'
        }}
      >
        <div
          style={{
            transform: `translateY(${visibleRange.startIndex * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {children(visibleData, visibleRange.startIndex, visibleRange.endIndex)}
        </div>
      </div>
    </div>
  );
};

/**
 * Time-based virtualization for long time periods
 */
export interface TimeVirtualizedChartProps {
  data: ChartDataPoint[];
  children: (visibleData: ChartDataPoint[], timeWindow: { start: Date; end: Date }) => React.ReactNode;
  windowSize: number; // Days to show at once
  totalDays?: number;
  onTimeRangeChange?: (start: Date, end: Date) => void;
}

export const TimeVirtualizedChart: React.FC<TimeVirtualizedChartProps> = ({
  data,
  children,
  windowSize,
  totalDays,
  onTimeRangeChange
}) => {
  // Calculate date range from data
  const dateRange = useMemo(() => {
    if (data.length === 0) return { start: new Date(), end: new Date() };

    const dates = data.map(d => new Date(d.date));
    const start = new Date(Math.min(...dates.map(d => d.getTime())));
    const end = new Date(Math.max(...dates.map(d => d.getTime())));

    return { start, end };
  }, [data]);

  const calculatedTotalDays = totalDays || Math.ceil(
    (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
  );

  const [currentWindowStart, setCurrentWindowStart] = useState(0); // Days from start

  // Calculate current time window
  const currentTimeWindow = useMemo(() => {
    const start = new Date(dateRange.start);
    start.setDate(start.getDate() + currentWindowStart);

    const end = new Date(start);
    end.setDate(end.getDate() + windowSize);

    return { start, end };
  }, [dateRange.start, currentWindowStart, windowSize]);

  // Filter data for current time window
  const visibleData = useMemo(() => {
    return data.filter(point => {
      const pointDate = new Date(point.date);
      return pointDate >= currentTimeWindow.start && pointDate <= currentTimeWindow.end;
    });
  }, [data, currentTimeWindow]);

  // Notify parent of time range changes
  useEffect(() => {
    if (onTimeRangeChange) {
      onTimeRangeChange(currentTimeWindow.start, currentTimeWindow.end);
    }
  }, [currentTimeWindow, onTimeRangeChange]);

  const handleWindowChange = (newStartDay: number) => {
    const maxStart = Math.max(0, calculatedTotalDays - windowSize);
    setCurrentWindowStart(Math.min(Math.max(0, newStartDay), maxStart));
  };

  const moveWindow = (direction: 'prev' | 'next') => {
    const step = Math.max(1, Math.floor(windowSize * 0.5)); // Move by half window
    const newStart = direction === 'prev' 
      ? currentWindowStart - step
      : currentWindowStart + step;
    
    handleWindowChange(newStart);
  };

  return (
    <div className="time-virtualized-chart">
      <div className="time-navigation-controls" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem',
        padding: '0.5rem',
        background: '#f5f5f5',
        borderRadius: '4px'
      }}>
        <button
          onClick={() => moveWindow('prev')}
          disabled={currentWindowStart <= 0}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            background: currentWindowStart <= 0 ? '#ccc' : '#007bff',
            color: 'white',
            cursor: currentWindowStart <= 0 ? 'not-allowed' : 'pointer'
          }}
        >
          ← Previous
        </button>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          fontSize: '0.9rem'
        }}>
          <span>
            {currentTimeWindow.start.toLocaleDateString()} - {currentTimeWindow.end.toLocaleDateString()}
          </span>
          
          <input
            type="range"
            min="0"
            max={Math.max(0, calculatedTotalDays - windowSize)}
            value={currentWindowStart}
            onChange={(e) => handleWindowChange(parseInt(e.target.value))}
            style={{ width: '200px' }}
          />
          
          <span style={{ color: '#666' }}>
            {Math.round((currentWindowStart / calculatedTotalDays) * 100)}%
          </span>
        </div>

        <button
          onClick={() => moveWindow('next')}
          disabled={currentWindowStart >= calculatedTotalDays - windowSize}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            background: currentWindowStart >= calculatedTotalDays - windowSize ? '#ccc' : '#007bff',
            color: 'white',
            cursor: currentWindowStart >= calculatedTotalDays - windowSize ? 'not-allowed' : 'pointer'
          }}
        >
          Next →
        </button>
      </div>

      {children(visibleData, currentTimeWindow)}
    </div>
  );
};