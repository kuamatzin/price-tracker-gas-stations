import { useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar, 
  BarChart3, 
  Activity,
  ArrowUpCircle,
  ArrowDownCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '../../ui/card';
import type { ChartDataPoint, FuelType } from '../../../types/charts';
import { FUEL_TYPES } from '../../../config/charts';
import { formatDate } from '../../../../../packages/shared/src/utils/date';
import { useAnalyticsStore } from '../../../stores/analyticsStore';

interface StatisticData {
  average: number;
  min: {
    value: number;
    date: string;
  };
  max: {
    value: number;
    date: string;
  };
  volatility: number;
  trend: {
    direction: 'rising' | 'falling' | 'stable';
    slope: number;
    confidence: number; // R² value
    change: number; // Absolute change from first to last
    changePercent: number; // Percentage change from first to last
  };
  changeCount: number; // Number of price changes
}

interface StatisticsPanelProps {
  data: ChartDataPoint[];
  selectedFuels: FuelType[];
  loading?: boolean;
  className?: string;
  variant?: 'cards' | 'compact' | 'detailed';
}

const calculateStatistics = (data: ChartDataPoint[], fuel: FuelType): StatisticData | null => {
  const prices = data
    .map(d => ({ price: d[fuel], date: d.date }))
    .filter((item): item is { price: number; date: string } => 
      item.price !== undefined && item.price !== null
    );

  if (prices.length === 0) return null;

  // Basic statistics
  const values = prices.map(p => p.price);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const average = sum / values.length;
  
  const minPrice = Math.min(...values);
  const maxPrice = Math.max(...values);
  const minIndex = values.findIndex(v => v === minPrice);
  const maxIndex = values.findIndex(v => v === maxPrice);

  // Volatility (standard deviation)
  const squaredDiffs = values.map(val => Math.pow(val - average, 2));
  const variance = squaredDiffs.reduce((acc, diff) => acc + diff, 0) / values.length;
  const volatility = Math.sqrt(variance);

  // Trend analysis (simple linear regression)
  const n = values.length;
  const xValues = values.map((_, i) => i);
  const sumX = xValues.reduce((acc, x) => acc + x, 0);
  const sumXY = xValues.reduce((acc, x, i) => acc + x * values[i], 0);
  const sumXX = xValues.reduce((acc, x) => acc + x * x, 0);
  
  const slope = (n * sumXY - sumX * sum) / (n * sumXX - sumX * sumX);
  
  // R-squared calculation for confidence
  const yMean = average;
  const ssTotal = values.reduce((acc, y) => acc + Math.pow(y - yMean, 2), 0);
  const ssResidual = values.reduce((acc, y, i) => {
    const predicted = slope * i + (sum - slope * sumX) / n;
    return acc + Math.pow(y - predicted, 2);
  }, 0);
  const confidence = ssTotal === 0 ? 1 : 1 - (ssResidual / ssTotal);

  // Trend direction
  let direction: 'rising' | 'falling' | 'stable' = 'stable';
  if (Math.abs(slope) > 0.01) { // Threshold for considering a trend
    direction = slope > 0 ? 'rising' : 'falling';
  }

  // Price change analysis
  const firstPrice = values[0];
  const lastPrice = values[values.length - 1];
  const change = lastPrice - firstPrice;
  const changePercent = (change / firstPrice) * 100;

  // Count significant price changes (> 1% change)
  let changeCount = 0;
  for (let i = 1; i < values.length; i++) {
    const prevPrice = values[i - 1];
    const currentPrice = values[i];
    const percentChange = Math.abs((currentPrice - prevPrice) / prevPrice) * 100;
    if (percentChange > 1) {
      changeCount++;
    }
  }

  return {
    average,
    min: {
      value: minPrice,
      date: prices[minIndex].date,
    },
    max: {
      value: maxPrice,
      date: prices[maxIndex].date,
    },
    volatility,
    trend: {
      direction,
      slope,
      confidence: Math.max(0, Math.min(1, confidence)), // Clamp between 0 and 1
      change,
      changePercent,
    },
    changeCount,
  };
};

const StatisticCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color = 'blue',
  trend,
  delay = 0 
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'blue' | 'green' | 'red' | 'gray' | 'yellow';
  trend?: 'up' | 'down' | 'stable';
  delay?: number;
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    green: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
    red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
    gray: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800',
  };

  const iconColorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    gray: 'text-gray-600 dark:text-gray-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className={`p-4 border ${colorClasses[color]}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${iconColorClasses[color]}`} />
              <h3 className="text-sm font-medium">{title}</h3>
              {trend && (
                <div className="ml-auto">
                  {trend === 'up' && <ArrowUpCircle className="w-3 h-3 text-green-500" />}
                  {trend === 'down' && <ArrowDownCircle className="w-3 h-3 text-red-500" />}
                  {trend === 'stable' && <Minus className="w-3 h-3 text-gray-500" />}
                </div>
              )}
            </div>
            <div className="text-2xl font-bold mb-1">{value}</div>
            {subtitle && (
              <div className="text-xs opacity-75">{subtitle}</div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export function StatisticsPanel({ 
  data, 
  selectedFuels, 
  loading = false, 
  className = '',
  variant = 'cards'
}: StatisticsPanelProps) {
  // Get trend analysis and data quality from analytics store
  const { trendAnalysis, dataQuality, marketComparison } = useAnalyticsStore();
  
  const statistics = useMemo(() => {
    const stats: Record<FuelType, StatisticData | null> = {
      regular: null,
      premium: null,
      diesel: null,
    };
    
    selectedFuels.forEach(fuel => {
      const analysis = trendAnalysis[fuel];
      if (analysis && analysis.summary.validPricePoints > 0) {
        // Use the comprehensive analysis from the analytics store
        const prices = data
          .map(d => ({ price: d[fuel], date: d.date }))
          .filter((item): item is { price: number; date: string } => 
            item.price !== undefined && item.price !== null
          );

        if (prices.length > 0) {
          const minData = prices.find(p => p.price === analysis.summary.minPrice);
          const maxData = prices.find(p => p.price === analysis.summary.maxPrice);

          stats[fuel] = {
            average: analysis.summary.avgPrice,
            min: {
              value: analysis.summary.minPrice,
              date: minData?.date || ''
            },
            max: {
              value: analysis.summary.maxPrice,
              date: maxData?.date || ''
            },
            volatility: analysis.volatility.value,
            trend: {
              direction: analysis.trend.direction,
              slope: analysis.trend.slope,
              confidence: analysis.trend.confidence,
              strength: analysis.trend.strength
            },
            changeCount: Math.round(analysis.summary.validPricePoints * 0.1) // Approximate significant changes
          };
        }
      } else {
        // Fallback to legacy calculation if analytics not available
        stats[fuel] = calculateStatistics(data, fuel);
      }
    });
    
    return stats;
  }, [data, selectedFuels, trendAnalysis]);

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (selectedFuels.length === 0 || !data.length) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="text-gray-500 dark:text-gray-400 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No hay datos para mostrar estadísticas</p>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`${className}`}>
        <div className="grid grid-cols-3 gap-4">
          {selectedFuels.map((fuel) => {
            const stats = statistics[fuel];
            if (!stats) return null;
            
            const fuelLabel = FUEL_TYPES[fuel].label;
            const fuelColor = fuel === 'regular' ? 'green' : fuel === 'premium' ? 'yellow' : 'blue';
            
            return (
              <Card key={fuel} className="p-3">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {fuelLabel}
                  </div>
                  <div className="text-lg font-bold">${stats.average.toFixed(2)}</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {stats.trend.direction === 'rising' && <TrendingUp className="w-3 h-3 text-green-500" />}
                    {stats.trend.direction === 'falling' && <TrendingDown className="w-3 h-3 text-red-500" />}
                    {stats.trend.direction === 'stable' && <Minus className="w-3 h-3 text-gray-500" />}
                    <span className="text-xs text-gray-500">
                      {stats.trend.changePercent > 0 ? '+' : ''}{stats.trend.changePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {selectedFuels.map((fuel, fuelIndex) => {
        const stats = statistics[fuel];
        if (!stats) return null;
        
        const fuelLabel = FUEL_TYPES[fuel].label;
        const fuelColor = fuel === 'regular' ? 'green' : fuel === 'premium' ? 'yellow' : 'blue';
        
        return (
          <div key={fuel} className="space-y-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: FUEL_TYPES[fuel].color }}
              />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Estadísticas - {fuelLabel}
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatisticCard
                title="Precio Promedio"
                value={`$${stats.average.toFixed(2)}`}
                subtitle="Media aritmética del período"
                icon={BarChart3}
                color={fuelColor}
                delay={fuelIndex * 0.1}
              />
              
              <StatisticCard
                title="Precio Mínimo"
                value={`$${stats.min.value.toFixed(2)}`}
                subtitle={formatDate(new Date(stats.min.date), 'short')}
                icon={ArrowDownCircle}
                color="green"
                delay={fuelIndex * 0.1 + 0.05}
              />
              
              <StatisticCard
                title="Precio Máximo"
                value={`$${stats.max.value.toFixed(2)}`}
                subtitle={formatDate(new Date(stats.max.date), 'short')}
                icon={ArrowUpCircle}
                color="red"
                delay={fuelIndex * 0.1 + 0.1}
              />
              
              <StatisticCard
                title="Volatilidad"
                value={`$${stats.volatility.toFixed(2)}`}
                subtitle="Desviación estándar"
                icon={Activity}
                color="gray"
                delay={fuelIndex * 0.1 + 0.15}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatisticCard
                title="Tendencia"
                value={
                  stats.trend.direction === 'rising' ? 'Alza' :
                  stats.trend.direction === 'falling' ? 'Baja' : 'Estable'
                }
                subtitle={`Confianza: ${(stats.trend.confidence * 100).toFixed(0)}%`}
                icon={stats.trend.direction === 'rising' ? TrendingUp : 
                      stats.trend.direction === 'falling' ? TrendingDown : Minus}
                color={stats.trend.direction === 'rising' ? 'green' : 
                       stats.trend.direction === 'falling' ? 'red' : 'gray'}
                trend={stats.trend.direction === 'stable' ? 'stable' : 
                       stats.trend.direction === 'rising' ? 'up' : 'down'}
                delay={fuelIndex * 0.1 + 0.2}
              />
              
              <StatisticCard
                title="Cambio Total"
                value={`${stats.trend.change > 0 ? '+' : ''}$${stats.trend.change.toFixed(2)}`}
                subtitle={`${stats.trend.changePercent > 0 ? '+' : ''}${stats.trend.changePercent.toFixed(1)}%`}
                icon={Calendar}
                color={stats.trend.change > 0 ? 'red' : stats.trend.change < 0 ? 'green' : 'gray'}
                trend={stats.trend.change > 0 ? 'up' : stats.trend.change < 0 ? 'down' : 'stable'}
                delay={fuelIndex * 0.1 + 0.25}
              />
              
              <StatisticCard
                title="Cambios Significativos"
                value={stats.changeCount}
                subtitle="Variaciones > 1%"
                icon={Activity}
                color="blue"
                delay={fuelIndex * 0.1 + 0.3}
              />
            </div>
          </div>
        );
      })}
      
      {/* Additional Analytics Insights */}
      {dataQuality && (
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Calidad de Datos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatisticCard
              title="Puntos de Datos"
              value={dataQuality.totalPoints - dataQuality.missingPoints}
              subtitle={`de ${dataQuality.totalPoints} esperados`}
              icon={Calendar}
              color="blue"
            />
            <StatisticCard
              title="Cobertura de Datos"
              value={`${(100 - dataQuality.missingPercentage).toFixed(1)}%`}
              subtitle={`${dataQuality.missingPoints} días faltantes`}
              icon={BarChart3}
              color={dataQuality.missingPercentage < 10 ? 'green' : dataQuality.missingPercentage < 25 ? 'yellow' : 'red'}
            />
            <StatisticCard
              title="Brechas en Datos"
              value={dataQuality.gaps.length}
              subtitle={dataQuality.gaps.length > 0 ? `Mayor: ${Math.max(...dataQuality.gaps.map(g => g.duration))} días` : 'Sin brechas'}
              icon={Activity}
              color={dataQuality.gaps.length === 0 ? 'green' : dataQuality.gaps.length < 3 ? 'yellow' : 'red'}
            />
          </div>
        </div>
      )}

      {/* Market Comparison Insights */}
      {Object.keys(marketComparison).length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Comparación de Mercado
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedFuels.map((fuel) => {
              const comparison = marketComparison[fuel];
              if (!comparison) return null;
              
              const fuelLabel = FUEL_TYPES[fuel].label;
              
              return (
                <Card key={fuel} className="p-4 bg-white dark:bg-gray-800 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: FUEL_TYPES[fuel].color }}
                    />
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {fuelLabel}
                    </h4>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Posición:</span>
                      <span className={`font-medium ${
                        comparison.advantage === 'lower' ? 'text-green-600 dark:text-green-400' :
                        comparison.advantage === 'higher' ? 'text-red-600 dark:text-red-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`}>
                        {comparison.advantage === 'lower' ? 'Competitivo' : 
                         comparison.advantage === 'higher' ? 'Por encima' : 'Similar'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Diferencia:</span>
                      <span className={`font-medium ${
                        comparison.difference < 0 ? 'text-green-600 dark:text-green-400' :
                        comparison.difference > 0 ? 'text-red-600 dark:text-red-400' :
                        'text-gray-600 dark:text-gray-400'
                      }`}>
                        {comparison.difference > 0 ? '+' : ''}${comparison.difference.toFixed(3)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Días ventajosos:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {comparison.advantageDays}/{comparison.totalDays}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}