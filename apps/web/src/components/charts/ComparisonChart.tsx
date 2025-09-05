import { useMemo } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ComposedChart,
} from 'recharts';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
  isDark?: boolean;
}

interface EnhancedComparisonDataPoint extends ComparisonDataPoint {
  userPrice?: number;
  marketPrice?: number;
  difference?: number;
  percentageDifference?: number;
  isAdvantage?: boolean;
}

const CustomComparisonTooltip = ({ 
  active, 
  payload, 
  label,
  showPercentageDifference = true 
}: TooltipProps & { showPercentageDifference?: boolean }) => {
  if (!active || !payload?.length) return null;

  const theme = getChartTheme();
  
  // Extract the data point
  const dataPoint = payload[0]?.payload as EnhancedComparisonDataPoint;
  
  return (
    <div 
      className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700"
      style={theme.tooltip}
    >
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
        {format(new Date(label || ''), 'PPp')}
      </p>
      
      <div className="space-y-2">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {entry.name}:
              </span>
            </div>
            <span className="font-medium">
              ${Number(entry.value || 0).toFixed(2)}
            </span>
          </div>
        ))}
        
        {dataPoint?.difference !== undefined && (
          <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {dataPoint.isAdvantage ? (
                  <TrendingDown className="w-3 h-3 text-green-500" />
                ) : (
                  <TrendingUp className="w-3 h-3 text-red-500" />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Diferencia:
                </span>
              </div>
              <div className="text-right">
                <div className={`font-medium ${
                  dataPoint.isAdvantage ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${Math.abs(dataPoint.difference).toFixed(2)}
                </div>
                {showPercentageDifference && dataPoint.percentageDifference !== undefined && (
                  <div className={`text-xs ${
                    dataPoint.isAdvantage ? 'text-green-500' : 'text-red-500'
                  }`}>
                    ({dataPoint.percentageDifference > 0 ? '+' : ''}
                    {dataPoint.percentageDifference.toFixed(1)}%)
                  </div>
                )}
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

export function ComparisonChart({
  data,
  loading = false,
  error = null,
  selectedFuel,
  showPercentageDifference = true,
  showMarketPositionIndicators = true,
  isDark = false
}: ComparisonChartProps) {
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
    <div className="space-y-4">
      <ChartContainer>
        <ComposedChart
          data={enhancedData}
          margin={theme.margins}
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
            content={<CustomComparisonTooltip showPercentageDifference={showPercentageDifference} />}
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
            strokeWidth={theme.line.strokeWidth + 1}
            dot={{ strokeWidth: theme.line.dot.strokeWidth, r: theme.line.dot.r }}
            activeDot={{ strokeWidth: theme.line.activeDot.strokeWidth, r: theme.line.activeDot.r + 1 }}
            name={`${fuelLabel} - Tu precio`}
            connectNulls={false}
            {...animationProps}
          />

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
          data={enhancedData} 
        />
      )}
    </div>
  );
}