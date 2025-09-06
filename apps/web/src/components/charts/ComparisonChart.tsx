import { useMemo, useState, useCallback, useRef, useEffect, memo } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  ComposedChart,
} from 'recharts';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Minus, ZoomIn, ZoomOut, RotateCcw, Move, Focus, Crosshair } from 'lucide-react';
import { ChartContainer } from './ChartContainer';
import type { ComparisonDataPoint, FuelType, TooltipProps } from '../../types/charts';
import { FUEL_TYPES, CHART_CONFIG } from '../../config/charts';
import { getChartTheme } from '../../config/chartTheme';
import { createChartAnimationProps } from '../../utils/chartAnimations';

interface ComparisonChartProps {
  data: ComparisonDataPoint[];
  loading?: boolean;
  error?: string | null;
  selectedFuel: FuelType;
  showPercentageDifference?: boolean;
  showMarketPositionIndicators?: boolean;
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

interface EnhancedComparisonDataPoint extends ComparisonDataPoint {
  userPrice?: number;
  marketPrice?: number;
  difference?: number;
  percentageDifference?: number;
  isAdvantage?: boolean;
}

const EnhancedComparisonTooltip = ({ 
  active, 
  payload, 
  label,
  showPercentageDifference = true 
}: TooltipProps & { showPercentageDifference?: boolean }) => {
  if (!active || !payload?.length) return null;

  const theme = getChartTheme();
  const currentDate = new Date(label || '');
  
  // Extract the data point
  const dataPoint = (payload[0] as any)?.payload as EnhancedComparisonDataPoint;
  
  return (
    <div 
      className="bg-white p-4 rounded-lg shadow-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-600 min-w-[250px]"
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
      
      {/* Price Comparison */}
      <div className="space-y-3">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {entry.name}:
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                ${Number(entry.value || 0).toFixed(3)}
              </span>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                por litro
              </div>
            </div>
          </div>
        ))}
        
        {/* Market Comparison Analysis */}
        {dataPoint?.difference !== undefined && (
          <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {dataPoint.isAdvantage ? (
                    <TrendingDown className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {dataPoint.isAdvantage ? 'Ventaja' : 'Desventaja'}:
                  </span>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    dataPoint.isAdvantage ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ${Math.abs(dataPoint.difference).toFixed(3)}
                  </div>
                  {showPercentageDifference && dataPoint.percentageDifference !== undefined && (
                    <div className={`text-sm font-medium ${
                      dataPoint.isAdvantage ? 'text-green-500' : 'text-red-500'
                    }`}>
                      ({dataPoint.percentageDifference > 0 ? '+' : ''}
                      {dataPoint.percentageDifference.toFixed(1)}%)
                    </div>
                  )}
                </div>
              </div>
              
              {/* Market Position Summary */}
              <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                {dataPoint.isAdvantage 
                  ? '💰 Precio competitivo vs. mercado'
                  : '⚠️ Precio por encima del mercado'
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MarketPositionIndicator = ({ 
  data 
}: { 
  data: EnhancedComparisonDataPoint[]; 
}) => {
  const advantagePercentage = useMemo(() => {
    const validPoints = data.filter(point => 
      point.userPrice !== undefined && 
      point.marketPrice !== undefined
    );
    
    if (validPoints.length === 0) return 0;
    
    const advantagePoints = validPoints.filter(point => point.isAdvantage);
    return (advantagePoints.length / validPoints.length) * 100;
  }, [data]);

  const avgDifference = useMemo(() => {
    const validPoints = data.filter(point => point.difference !== undefined);
    if (validPoints.length === 0) return 0;
    
    const sum = validPoints.reduce((acc, point) => acc + (point.difference || 0), 0);
    return sum / validPoints.length;
  }, [data]);

  return (
    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="text-center">
        <div className="flex items-center justify-center mb-2">
          {advantagePercentage >= 50 ? (
            <TrendingDown className="w-5 h-5 text-green-500" />
          ) : (
            <TrendingUp className="w-5 h-5 text-red-500" />
          )}
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {advantagePercentage.toFixed(0)}%
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Ventaja de mercado
        </div>
      </div>
      
      <div className="text-center">
        <div className="flex items-center justify-center mb-2">
          {avgDifference < 0 ? (
            <TrendingDown className="w-5 h-5 text-green-500" />
          ) : avgDifference > 0 ? (
            <TrendingUp className="w-5 h-5 text-red-500" />
          ) : (
            <Minus className="w-5 h-5 text-gray-500" />
          )}
        </div>
        <div className={`text-2xl font-bold ${
          avgDifference < 0 ? 'text-green-600' : avgDifference > 0 ? 'text-red-600' : 'text-gray-600'
        }`}>
          ${Math.abs(avgDifference).toFixed(2)}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Diferencia promedio
        </div>
      </div>
    </div>
  );
};

const ComparisonChartComponent = memo(function ComparisonChart({
  data,
  loading = false,
  error = null,
  selectedFuel,
  showPercentageDifference = true,
  showMarketPositionIndicators = true,
  showZoomControls = true,
  isDark = false
}: ComparisonChartProps) {
  const [zoomState, setZoomState] = useState<ZoomState>({ zoomLevel: 1, panOffset: 0 });
  const [interactionState, setInteractionState] = useState<InteractionState>({ mode: 'zoom' });
  const chartRef = useRef<HTMLDivElement>(null);
  const [focusedDataIndex, setFocusedDataIndex] = useState<number>(-1);
  
  const theme = getChartTheme(isDark);
  const animationProps = createChartAnimationProps();
  
  const enhancedData = useMemo((): EnhancedComparisonDataPoint[] => {
    return data.map(point => {
      const userPrice = point[selectedFuel];
      const marketPrice = point.marketAverage?.[selectedFuel];
      
      if (userPrice === undefined || marketPrice === undefined) {
        return { ...point };
      }
      
      const difference = userPrice - marketPrice;
      const percentageDifference = ((difference / marketPrice) * 100);
      const isAdvantage = userPrice < marketPrice; // Lower price is advantage
      
      return {
        ...point,
        userPrice,
        marketPrice,
        difference,
        percentageDifference,
        isAdvantage,
      };
    });
  }, [data, selectedFuel]);
  
  // Filter data based on zoom state
  const filteredData = useMemo(() => {
    if (!zoomState.left || !zoomState.right) return enhancedData;
    
    const leftIndex = enhancedData.findIndex(item => item.date === zoomState.left);
    const rightIndex = enhancedData.findIndex(item => item.date === zoomState.right);
    
    if (leftIndex === -1 || rightIndex === -1) return enhancedData;
    
    return enhancedData.slice(
      Math.min(leftIndex, rightIndex),
      Math.max(leftIndex, rightIndex) + 1
    );
  }, [enhancedData, zoomState.left, zoomState.right]);

  const handleMouseDown = useCallback((e: { activeLabel?: string } | null) => {
    if (!showZoomControls || !e?.activeLabel) return;
    
    setZoomState(prev => ({
      ...prev,
      refAreaLeft: e.activeLabel,
      isZooming: true,
    }));
  }, [showZoomControls]);

  const handleMouseMove = useCallback((e: any) => {
    if (interactionState.mode === 'focus') {
      const rect = chartRef.current?.getBoundingClientRect();
      if (rect) {
        setInteractionState(prev => ({
          ...prev,
          crosshair: {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          }
        }));
      }
    }
    
    // Original zoom mouse move logic
    if (!zoomState.isZooming || !e?.activeLabel) return;
    
    setZoomState(prev => ({
      ...prev,
      refAreaRight: e.activeLabel,
    }));
  }, [zoomState.isZooming, interactionState.mode]);

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
        fuel: selectedFuel
      }
    }));
  }, [filteredData, selectedFuel]);

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

  if (loading) {
    return (
      <div className="space-y-4">
        <ChartContainer className="animate-pulse">
          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <div className="text-gray-500 dark:text-gray-400">Cargando comparación...</div>
          </div>
        </ChartContainer>
        {showMarketPositionIndicators && (
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        )}
      </div>
    );
  }

  if (error) {
    return (
      <ChartContainer className="flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-2">Error al cargar comparación</div>
          <div className="text-gray-500 text-sm">{error}</div>
        </div>
      </ChartContainer>
    );
  }

  if (!data?.length) {
    return (
      <ChartContainer className="flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">No hay datos de comparación disponibles</div>
      </ChartContainer>
    );
  }

  const fuelLabel = FUEL_TYPES[selectedFuel].label;
  const fuelColor = FUEL_TYPES[selectedFuel].color;

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
        <ComposedChart
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
          
          <Tooltip 
            content={<EnhancedComparisonTooltip showPercentageDifference={showPercentageDifference} />}
          />
          
          <Legend
            wrapperStyle={{
              fontSize: theme.legend.fontSize,
              fontFamily: theme.legend.fontFamily,
              color: theme.legend.color,
            }}
          />

          {/* Fill area between lines */}
          <defs>
            <linearGradient id="advantageGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="disadvantageGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
            </linearGradient>
          </defs>

          {/* Market average line */}
          <Line
            type="monotone"
            dataKey="marketPrice"
            stroke={CHART_CONFIG.colors.market}
            strokeWidth={theme.line.strokeWidth}
            strokeDasharray="5 5"
            dot={{ strokeWidth: theme.line.dot.strokeWidth, r: theme.line.dot.r }}
            activeDot={{ strokeWidth: theme.line.activeDot.strokeWidth, r: theme.line.activeDot.r }}
            name={`${fuelLabel} - Promedio del mercado`}
            connectNulls={false}
            {...animationProps}
          />

          {/* User price line */}
          <Line
            type="monotone"
            dataKey="userPrice"
            stroke={fuelColor}
            strokeWidth={interactionState.focusedPoint ? theme.line.strokeWidth + 2 : theme.line.strokeWidth + 1}
            dot={{ 
              strokeWidth: theme.line.dot.strokeWidth, 
              r: interactionState.focusedPoint ? theme.line.dot.r + 1 : theme.line.dot.r,
              fill: interactionState.focusedPoint ? fuelColor : undefined
            }}
            activeDot={{ 
              strokeWidth: theme.line.activeDot.strokeWidth, 
              r: interactionState.mode === 'focus' ? theme.line.activeDot.r + 2 : theme.line.activeDot.r + 1,
              fill: fuelColor,
              stroke: '#fff'
            }}
            name={`${fuelLabel} - Tu precio`}
            connectNulls={false}
            {...animationProps}
          />

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

          {/* Zero difference reference line */}
          <ReferenceLine
            y={0}
            stroke={theme.axis.stroke}
            strokeDasharray="2 2"
            strokeOpacity={0.5}
          />
        </ComposedChart>
      </ChartContainer>

      {/* Market Position Indicators */}
      {showMarketPositionIndicators && (
        <MarketPositionIndicator 
          data={filteredData} 
        />
      )}
    </div>
  );
});

export const ComparisonChart = ComparisonChartComponent;