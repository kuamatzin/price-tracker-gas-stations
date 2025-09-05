import { useState, useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
} from 'recharts';
import { format } from 'date-fns';
import { ChartContainer } from './ChartContainer';
import type { ChartProps, FuelType, TooltipProps } from '../../types/charts';
import { FUEL_TYPES, CHART_CONFIG } from '../../config/charts';
import { getChartTheme } from '../../config/chartTheme';
import { createChartAnimationProps } from '../../utils/chartAnimations';

interface TrendChartProps extends ChartProps {
  showZoomControls?: boolean;
  isDark?: boolean;
}

interface ZoomState {
  left?: string | number;
  right?: string | number;
  refAreaLeft?: string | number;
  refAreaRight?: string | number;
  isZooming?: boolean;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;

  const theme = getChartTheme();
  
  return (
    <div 
      className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700"
      style={theme.tooltip}
    >
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {format(new Date(label || ''), 'PPp')}
      </p>
      {payload.map((entry) => {
        const fuelType = entry.dataKey as FuelType;
        const fuelConfig = FUEL_TYPES[fuelType];
        
        if (!fuelConfig || entry.value === null || entry.value === undefined) {
          return null;
        }

        return (
          <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {fuelConfig.label}: ${Number(entry.value).toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export function TrendChart({ 
  data, 
  loading = false, 
  error = null,
  selectedFuels = ['regular', 'premium', 'diesel'],
  showZoomControls = true,
  isDark = false
}: Omit<TrendChartProps, 'onFuelToggle'>) {
  const [zoomState, setZoomState] = useState<ZoomState>({});
  
  const theme = getChartTheme(isDark);
  const animationProps = createChartAnimationProps();

  // Filter data based on zoom state
  const filteredData = useMemo(() => {
    if (!zoomState.left || !zoomState.right) return data;
    
    const leftIndex = data.findIndex(item => item.date === zoomState.left);
    const rightIndex = data.findIndex(item => item.date === zoomState.right);
    
    if (leftIndex === -1 || rightIndex === -1) return data;
    
    return data.slice(
      Math.min(leftIndex, rightIndex),
      Math.max(leftIndex, rightIndex) + 1
    );
  }, [data, zoomState.left, zoomState.right]);

  const handleMouseDown = useCallback((e: { activeLabel?: string } | null) => {
    if (!showZoomControls || !e?.activeLabel) return;
    
    setZoomState(prev => ({
      ...prev,
      refAreaLeft: e.activeLabel,
      isZooming: true,
    }));
  }, [showZoomControls]);

  const handleMouseMove = useCallback((e: { activeLabel?: string } | null) => {
    if (!zoomState.isZooming || !e?.activeLabel) return;
    
    setZoomState(prev => ({
      ...prev,
      refAreaRight: e.activeLabel,
    }));
  }, [zoomState.isZooming]);

  const handleMouseUp = useCallback(() => {
    if (!zoomState.isZooming || !zoomState.refAreaLeft || !zoomState.refAreaRight) {
      setZoomState({});
      return;
    }

    // Apply zoom
    setZoomState({
      left: zoomState.refAreaLeft,
      right: zoomState.refAreaRight,
      isZooming: false,
    });
  }, [zoomState]);

  const handleResetZoom = useCallback(() => {
    setZoomState({});
  }, []);

  if (loading) {
    return (
      <ChartContainer className="animate-pulse">
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">Cargando gráfico...</div>
        </div>
      </ChartContainer>
    );
  }

  if (error) {
    return (
      <ChartContainer className="flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-2">Error al cargar datos</div>
          <div className="text-gray-500 text-sm">{error}</div>
        </div>
      </ChartContainer>
    );
  }

  if (!data?.length) {
    return (
      <ChartContainer className="flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">No hay datos disponibles</div>
      </ChartContainer>
    );
  }

  return (
    <div className="space-y-4">
      {showZoomControls && (zoomState.left || zoomState.right) && (
        <div className="flex justify-end">
          <button
            onClick={handleResetZoom}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 transition-colors"
          >
            Restablecer zoom
          </button>
        </div>
      )}
      
      <ChartContainer>
        <LineChart
          data={filteredData}
          margin={theme.margins}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          {...animationProps}
        >
          <CartesianGrid 
            strokeDasharray={theme.grid.strokeDasharray}
            stroke={theme.grid.stroke}
          />
          
          <XAxis
            dataKey="date"
            tickFormatter={(value) => format(new Date(value), 'dd/MM')}
            stroke={theme.axis.stroke}
            fontSize={theme.axis.fontSize}
            fontFamily={theme.axis.fontFamily}
          />
          
          <YAxis
            tickFormatter={(value) => `$${value.toFixed(2)}`}
            stroke={theme.axis.stroke}
            fontSize={theme.axis.fontSize}
            fontFamily={theme.axis.fontFamily}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          <Legend
            wrapperStyle={{
              fontSize: theme.legend.fontSize,
              fontFamily: theme.legend.fontFamily,
              color: theme.legend.color,
            }}
          />

          {selectedFuels.includes('regular') && (
            <Line
              type="monotone"
              dataKey="regular"
              stroke={FUEL_TYPES.regular.color}
              strokeWidth={theme.line.strokeWidth}
              strokeLinecap={theme.line.strokeLinecap}
              strokeLinejoin={theme.line.strokeLinejoin}
              dot={{ strokeWidth: theme.line.dot.strokeWidth, r: theme.line.dot.r }}
              activeDot={{ strokeWidth: theme.line.activeDot.strokeWidth, r: theme.line.activeDot.r }}
              name={FUEL_TYPES.regular.label}
              connectNulls={false}
              {...animationProps}
            />
          )}

          {selectedFuels.includes('premium') && (
            <Line
              type="monotone"
              dataKey="premium"
              stroke={FUEL_TYPES.premium.color}
              strokeWidth={theme.line.strokeWidth}
              strokeLinecap={theme.line.strokeLinecap}
              strokeLinejoin={theme.line.strokeLinejoin}
              dot={{ strokeWidth: theme.line.dot.strokeWidth, r: theme.line.dot.r }}
              activeDot={{ strokeWidth: theme.line.activeDot.strokeWidth, r: theme.line.activeDot.r }}
              name={FUEL_TYPES.premium.label}
              connectNulls={false}
              {...animationProps}
            />
          )}

          {selectedFuels.includes('diesel') && (
            <Line
              type="monotone"
              dataKey="diesel"
              stroke={FUEL_TYPES.diesel.color}
              strokeWidth={theme.line.strokeWidth}
              strokeLinecap={theme.line.strokeLinecap}
              strokeLinejoin={theme.line.strokeLinejoin}
              dot={{ strokeWidth: theme.line.dot.strokeWidth, r: theme.line.dot.r }}
              activeDot={{ strokeWidth: theme.line.activeDot.strokeWidth, r: theme.line.activeDot.r }}
              name={FUEL_TYPES.diesel.label}
              connectNulls={false}
              {...animationProps}
            />
          )}

          {zoomState.refAreaLeft && zoomState.refAreaRight && (
            <ReferenceArea
              x1={zoomState.refAreaLeft}
              x2={zoomState.refAreaRight}
              strokeOpacity={0.3}
              fillOpacity={0.1}
              fill={CHART_CONFIG.colors.market}
            />
          )}
        </LineChart>
      </ChartContainer>
    </div>
  );
}