import { useState, useEffect } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { TrendChart } from '../../components/charts/TrendChart';
import { ComparisonChart } from '../../components/charts/ComparisonChart';
import { DateRangeSelector } from '../../components/features/analytics/DateRangeSelector';
import { FuelTypeToggle } from '../../components/features/analytics/FuelTypeToggle';
import { StatisticsPanel } from '../../components/features/analytics/StatisticsPanel';
import { useUIStore } from '../../stores/uiStore';
import type { ChartDataPoint, ComparisonDataPoint, FuelType } from '../../types/charts';

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

// Generate comparison data with market averages
const generateComparisonData = (days: number): ComparisonDataPoint[] => {
  const data: ComparisonDataPoint[] = [];
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // User prices (simulated with some variation)
    const basePrice = 20 + Math.random() * 5;
    const userRegular = basePrice + Math.random() * 2 - 1;
    const userPremium = basePrice + 2 + Math.random() * 2 - 1;
    const userDiesel = basePrice - 1 + Math.random() * 2 - 1;
    
    // Market averages (typically slightly different from user prices)
    const marketVariation = (Math.random() - 0.5) * 3; // -1.5 to +1.5 variation
    
    data.push({
      date: date.toISOString(),
      regular: userRegular,
      premium: userPremium,
      diesel: userDiesel,
      marketAverage: {
        regular: userRegular + marketVariation * 0.8,
        premium: userPremium + marketVariation,
        diesel: userDiesel + marketVariation * 0.9,
      }
    });
  }
  
  return data;
};


type ChartType = 'trends' | 'comparison';

export default function HistoricalTrends() {
  const { activeFilters } = useUIStore();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFuels, setSelectedFuels] = useState<FuelType[]>(['regular', 'premium', 'diesel']);
  const [chartType, setChartType] = useState<ChartType>('trends');
  const [comparisonFuel, setComparisonFuel] = useState<FuelType>('regular');

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
      
      const trendData = generateMockData(daysDiff);
      const compData = generateComparisonData(daysDiff);
      setChartData(trendData);
      setComparisonData(compData);
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
      const trendData = generateMockData(daysDiff);
      const compData = generateComparisonData(daysDiff);
      setChartData(trendData);
      setComparisonData(compData);
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
              Tipo de gráfico
            </h3>
            <div className="flex gap-2">
              <Button
                variant={chartType === 'trends' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('trends')}
              >
                Tendencias
              </Button>
              <Button
                variant={chartType === 'comparison' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('comparison')}
              >
                Comparación vs Mercado
              </Button>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Rango de fechas
            </h3>
            <DateRangeSelector />
          </div>
          
          {chartType === 'trends' ? (
            <FuelTypeToggle
              selectedFuels={selectedFuels}
              onFuelToggle={toggleFuel}
              onSelectAll={selectAllFuels}
              onDeselectAll={deselectAllFuels}
              variant="tabs"
              showSelectAll={true}
            />
          ) : (
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Combustible para comparar
              </h3>
              <div className="flex gap-2">
                {(['regular', 'premium', 'diesel'] as FuelType[]).map((fuel) => (
                  <Button
                    key={fuel}
                    variant={comparisonFuel === fuel ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setComparisonFuel(fuel)}
                  >
                    {fuel === 'regular' ? 'Magna' : fuel === 'premium' ? 'Premium' : 'Diésel'}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Chart */}
      <Card className="p-4">
        {chartType === 'trends' ? (
          <TrendChart
            data={chartData}
            loading={loading}
            selectedFuels={selectedFuels}
            showZoomControls={true}
          />
        ) : (
          <ComparisonChart
            data={comparisonData}
            loading={loading}
            selectedFuel={comparisonFuel}
            showPercentageDifference={true}
            showMarketPositionIndicators={true}
          />
        )}
      </Card>

      {/* Statistics - Only show for trends view */}
      {chartType === 'trends' && (
        <StatisticsPanel
          data={chartData}
          selectedFuels={selectedFuels}
          loading={loading}
          variant="cards"
        />
      )}
    </div>
  );
}