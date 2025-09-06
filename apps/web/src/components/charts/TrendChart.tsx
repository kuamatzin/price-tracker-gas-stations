import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { ZoomIn, ZoomOut, RotateCcw, Move, Focus, Crosshair } from 'lucide-react';
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
  zoomLevel?: number;
  panOffset?: number;
}

interface InteractionState {
  mode: 'zoom' | 'pan' | 'focus';
  crosshair?: { x: number; y: number };
  focusedPoint?: { date: string; fuel: FuelType };
  isKeyboardNavigation?: boolean;
}

const EnhancedTooltip = ({ active, payload, label }: TooltipProps & { previousData?: any }) => {
  if (!active || !payload?.length) return null;

  const theme = getChartTheme();
  const currentDate = new Date(label || '');
  
  return (
    <div 
      className="bg-white p-4 rounded-lg shadow-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-600 min-w-[200px]"
      style={theme.tooltip}
    >
      {/* Date Header */}
      <div className="border-b border-gray-200 dark:border-gray-600 pb-2 mb-3">
        <p className="font-bold text-gray-900 dark:text-gray-100 text-base">
          {format(currentDate, 'EEEE, dd MMMM yyyy')}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {format(currentDate, 'HH:mm')}
        </p>
      </div>

      {/* Fuel Prices */}
      <div className="space-y-2">
        {payload.map((entry) => {
          const fuelType = entry.dataKey as FuelType;
          const fuelConfig = FUEL_TYPES[fuelType];
          
          if (!fuelConfig || entry.value === null || entry.value === undefined) {
            return null;
          }

          const price = Number(entry.value);
          
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {fuelConfig.label}
                </span>
              </div>
              
              <div className="text-right">
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  ${price.toFixed(3)}
                </span>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  por litro
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Stats */}
      {payload.length > 1 && (
        <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-3">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Promedio:</span>
              <span>${(payload.reduce((sum, entry) => sum + Number(entry.value || 0), 0) / payload.length).toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span>Rango:</span>
              <span>${(Math.max(...payload.map(p => Number(p.value || 0))) - Math.min(...payload.map(p => Number(p.value || 0)))).toFixed(3)}</span>
            </div>
          </div>
        </div>
      )}
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
  const [zoomState, setZoomState] = useState<ZoomState>({ zoomLevel: 1, panOffset: 0 });
  const [interactionState, setInteractionState] = useState<InteractionState>({ mode: 'zoom' });
  const chartRef = useRef<HTMLDivElement>(null);
  const [focusedDataIndex, setFocusedDataIndex] = useState<number>(-1);
  
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

  const handleMouseMoveZoom = useCallback((e: { activeLabel?: string } | null) => {
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
    setZoomState({ zoomLevel: 1, panOffset: 0 });
    setFocusedDataIndex(-1);
  }, []);

  // Enhanced zoom controls
  const handleZoomIn = useCallback(() => {
    setZoomState(prev => ({
      ...prev,
      zoomLevel: Math.min((prev.zoomLevel || 1) * 1.5, 10)
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomState(prev => ({
      ...prev,
      zoomLevel: Math.max((prev.zoomLevel || 1) / 1.5, 0.1)
    }));
  }, []);

  // Pan functionality
  const handlePan = useCallback((direction: 'left' | 'right') => {
    const dataLength = filteredData.length;
    if (dataLength === 0) return;

    const step = Math.max(1, Math.floor(dataLength * 0.1)); // Pan by 10% of visible data
    
    setZoomState(prev => {
      const newOffset = direction === 'left' 
        ? Math.max((prev.panOffset || 0) - step, -dataLength / 2)
        : Math.min((prev.panOffset || 0) + step, dataLength / 2);
      
      return { ...prev, panOffset: newOffset };
    });
  }, [filteredData.length]);

  // Click to focus functionality
  const handleDataPointClick = useCallback((data: any) => {
    if (!data || !data.activeTooltipIndex) return;
    
    const clickedIndex = data.activeTooltipIndex;
    setFocusedDataIndex(clickedIndex);
    setInteractionState(prev => ({
      ...prev,
      focusedPoint: {
        date: filteredData[clickedIndex]?.date || '',
        fuel: selectedFuels[0] // Default to first selected fuel
      }
    }));
  }, [filteredData, selectedFuels]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!chartRef.current || !document.activeElement || !chartRef.current.contains(document.activeElement)) {
        return;
      }

      e.preventDefault();
      
      switch (e.key) {
        case 'ArrowLeft':
          if (e.ctrlKey || e.metaKey) {
            handlePan('left');
          } else {
            setFocusedDataIndex(prev => Math.max(0, prev - 1));
          }
          break;
        case 'ArrowRight':
          if (e.ctrlKey || e.metaKey) {
            handlePan('right');
          } else {
            setFocusedDataIndex(prev => Math.min(filteredData.length - 1, prev + 1));
          }
          break;
        case '=':
        case '+':
          if (e.ctrlKey || e.metaKey) {
            handleZoomIn();
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            handleZoomOut();
          }
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            handleResetZoom();
          }
          break;
        case 'Escape':
          setFocusedDataIndex(-1);
          setInteractionState(prev => ({ ...prev, focusedPoint: undefined }));
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredData.length, handlePan, handleZoomIn, handleZoomOut, handleResetZoom]);

  // Crosshair on mouse move
  const handleMouseMove = useCallback((e: any) => {
    if (!e || interactionState.mode !== 'focus') return;
    
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;

    setInteractionState(prev => ({
      ...prev,
      crosshair: {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }));

    // Original zoom mouse move logic
    if (!zoomState.isZooming || !e?.activeLabel) return;
    
    setZoomState(prev => ({
      ...prev,
      refAreaRight: e.activeLabel,
    }));
  }, [zoomState.isZooming, interactionState.mode]);

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
    <div className="space-y-4" ref={chartRef}>
      {/* Enhanced Controls */}
      {showZoomControls && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomIn}
              className="p-2 text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shadow-sm"
              title="Ampliar (Ctrl/Cmd + +)"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shadow-sm"
              title="Reducir (Ctrl/Cmd + -)"
            >
              <ZoomOut size={16} />
            </button>
            <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
              {Math.round((zoomState.zoomLevel || 1) * 100)}%
            </div>
          </div>

          {/* Pan Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePan('left')}
              className="p-2 text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shadow-sm"
              title="Desplazar izquierda (Ctrl/Cmd + ←)"
            >
              <Move size={16} className="rotate-180" />
            </button>
            <button
              onClick={() => handlePan('right')}
              className="p-2 text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shadow-sm"
              title="Desplazar derecha (Ctrl/Cmd + →)"
            >
              <Move size={16} />
            </button>
          </div>

          {/* Interaction Mode Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInteractionState(prev => ({ ...prev, mode: prev.mode === 'zoom' ? 'focus' : 'zoom' }))}
              className={`p-2 text-sm rounded-md transition-colors shadow-sm ${
                interactionState.mode === 'focus'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              title={interactionState.mode === 'zoom' ? 'Cambiar a modo foco' : 'Cambiar a modo zoom'}
            >
              {interactionState.mode === 'zoom' ? <Crosshair size={16} /> : <Focus size={16} />}
            </button>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleResetZoom}
            className="p-2 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors shadow-sm"
            title="Restablecer vista (Ctrl/Cmd + 0)"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      )}

      {/* Keyboard Navigation Hint */}
      {focusedDataIndex >= 0 && (
        <div className="text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
          💡 Usa las flechas ← → para navegar, Ctrl/Cmd + +/- para zoom, Escape para salir
        </div>
      )}
      
      <ChartContainer>
        <LineChart
          data={filteredData}
          margin={theme.margins}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleDataPointClick}
          style={{ cursor: interactionState.mode === 'focus' ? 'crosshair' : 'default' }}
          tabIndex={0} // Make chart focusable for keyboard navigation
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
          
          <Tooltip content={<EnhancedTooltip />} />
          
          <Legend
            wrapperStyle={{
              fontSize: theme.legend.fontSize,
              fontFamily: theme.legend.fontFamily,
              color: theme.legend.color,
            }}
          />

          {selectedFuels.map((fuel) => {
            const fuelConfig = FUEL_TYPES[fuel];
            if (!fuelConfig) return null;
            
            const isFocused = interactionState.focusedPoint?.fuel === fuel;
            
            return (
              <Line
                key={fuel}
                type="monotone"
                dataKey={fuel}
                stroke={fuelConfig.color}
                strokeWidth={isFocused ? theme.line.strokeWidth + 1 : theme.line.strokeWidth}
                strokeLinecap={theme.line.strokeLinecap}
                strokeLinejoin={theme.line.strokeLinejoin}
                dot={{ 
                  strokeWidth: theme.line.dot.strokeWidth, 
                  r: isFocused ? theme.line.dot.r + 1 : theme.line.dot.r,
                  fill: isFocused ? fuelConfig.color : undefined
                }}
                activeDot={{ 
                  strokeWidth: theme.line.activeDot.strokeWidth, 
                  r: interactionState.mode === 'focus' ? theme.line.activeDot.r + 2 : theme.line.activeDot.r,
                  fill: fuelConfig.color,
                  stroke: '#fff'
                }}
                name={fuelConfig.label}
                connectNulls={false}
                {...animationProps}
              />
            );
          })}

          {/* Focus indicator */}
          {focusedDataIndex >= 0 && filteredData[focusedDataIndex] && (
            <ReferenceLine 
              x={filteredData[focusedDataIndex].date}
              stroke="#3b82f6"
              strokeDasharray="2 2"
              strokeWidth={1}
              label={{ value: "Foco", position: "top" }}
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