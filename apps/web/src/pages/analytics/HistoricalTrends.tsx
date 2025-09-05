import { useState, useEffect } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { TrendChart } from '../../components/charts/TrendChart';
import { DateRangeSelector } from '../../components/features/analytics/DateRangeSelector';
import { FuelTypeToggle } from '../../components/features/analytics/FuelTypeToggle';
import { useUIStore } from '../../stores/uiStore';
import type { ChartDataPoint, FuelType } from '../../types/charts';

// Mock data for demonstration - in a real app this would come from API
const generateMockData = (days: number): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const basePrice = 20 + Math.random() * 5;
    
    data.push({
      date: date.toISOString(),
      regular: basePrice + Math.random() * 2 - 1,
      premium: basePrice + 2 + Math.random() * 2 - 1,
      diesel: basePrice - 1 + Math.random() * 2 - 1,
    });
  }
  
  return data;
};

const calculateStatistics = (data: ChartDataPoint[], fuelType: FuelType) => {
  const prices = data
    .map(d => d[fuelType])
    .filter((price): price is number => price !== undefined && price !== null);
  
  if (prices.length === 0) return null;
  
  const sum = prices.reduce((acc, price) => acc + price, 0);
  const average = sum / prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  
  // Simple volatility calculation (standard deviation)
  const squaredDiffs = prices.map(price => Math.pow(price - average, 2));
  const variance = squaredDiffs.reduce((acc, diff) => acc + diff, 0) / prices.length;
  const volatility = Math.sqrt(variance);
  
  return {
    average: average.toFixed(2),
    min: min.toFixed(2),
    max: max.toFixed(2),
    volatility: volatility.toFixed(2),
  };
};

export default function HistoricalTrends() {
  const { activeFilters } = useUIStore();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFuels, setSelectedFuels] = useState<FuelType[]>(['regular', 'premium', 'diesel']);

  // Load data based on date range
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Calculate days from date range
      const fromDate = activeFilters.dateRange.from ? new Date(activeFilters.dateRange.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const toDate = activeFilters.dateRange.to ? new Date(activeFilters.dateRange.to) : new Date();
      const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const data = generateMockData(daysDiff);
      setChartData(data);
      setLoading(false);
    };

    loadData();
  }, [activeFilters.dateRange]);

  const handleRefresh = () => {
    const fromDate = activeFilters.dateRange.from ? new Date(activeFilters.dateRange.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = activeFilters.dateRange.to ? new Date(activeFilters.dateRange.to) : new Date();
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 1000 * 24));
    
    setLoading(true);
    setTimeout(() => {
      const data = generateMockData(daysDiff);
      setChartData(data);
      setLoading(false);
    }, 500);
  };

  const handleExport = () => {
    const csvContent = [
      ['Fecha', 'Magna', 'Premium', 'Diesel'],
      ...chartData.map(item => [
        new Date(item.date).toLocaleDateString('es-MX'),
        item.regular?.toFixed(2) || '',
        item.premium?.toFixed(2) || '',
        item.diesel?.toFixed(2) || '',
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'tendencias-historicas.csv';
    link.click();
  };

  const toggleFuel = (fuel: FuelType) => {
    setSelectedFuels(prev => 
      prev.includes(fuel) 
        ? prev.filter(f => f !== fuel)
        : [...prev, fuel]
    );
  };

  const selectAllFuels = () => {
    setSelectedFuels(['regular', 'premium', 'diesel']);
  };

  const deselectAllFuels = () => {
    setSelectedFuels([]);
  };

  const statistics = {
    regular: calculateStatistics(chartData, 'regular'),
    premium: calculateStatistics(chartData, 'premium'),
    diesel: calculateStatistics(chartData, 'diesel'),
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tendencias Históricas
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Analiza la evolución de precios en el tiempo
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!chartData.length}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Rango de fechas
            </h3>
            <DateRangeSelector />
          </div>
          
          <FuelTypeToggle
            selectedFuels={selectedFuels}
            onFuelToggle={toggleFuel}
            onSelectAll={selectAllFuels}
            onDeselectAll={deselectAllFuels}
            variant="tabs"
            showSelectAll={true}
          />
        </div>
      </Card>

      {/* Chart */}
      <Card className="p-4">
        <TrendChart
          data={chartData}
          loading={loading}
          selectedFuels={selectedFuels}
          showZoomControls={true}
        />
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {selectedFuels.map((fuel) => {
          const stats = statistics[fuel];
          if (!stats) return null;
          
          const fuelLabel = fuel === 'regular' ? 'Magna' : fuel === 'premium' ? 'Premium' : 'Diésel';
          
          return (
            <Card key={fuel} className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {fuelLabel}
              </h3>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Promedio:</span>
                  <span className="font-medium">${stats.average}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Mínimo:</span>
                  <span className="font-medium text-green-600">${stats.min}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Máximo:</span>
                  <span className="font-medium text-red-600">${stats.max}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Volatilidad:</span>
                  <span className="font-medium">${stats.volatility}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}