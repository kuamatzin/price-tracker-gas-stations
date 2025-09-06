import { useEffect, useState } from "react";
import { RefreshCw, Download, Map, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

// Import our new components
import PriceCard from "@/components/features/pricing/PriceCard";
import CompetitorTable from "@/components/features/competitors/CompetitorTable";
import StationMap from "@/components/features/map/StationMap";
import PriceFilters from "@/components/features/filters/PriceFilters";

// Import store and utilities
import { usePricingStore } from "@/stores/pricingStore";
import { exportStationsToCSV, validateExportData } from "@/utils/csvExport";

const Prices = () => {
  const [activeTab, setActiveTab] = useState<"table" | "map">("table");
  const [isExporting, setIsExporting] = useState(false);

  // Store state
  const {
    currentPrices,
    userStation,
    competitors,
    marketAverages,
    filters,
    availableBrands,
    isLoading,
    error,
    lastUpdated,
    autoRefreshEnabled,
    fetchCurrentPrices,
    fetchCompetitors,
    fetchMarketAverages,
    setFilters,
    startAutoRefresh,
    stopAutoRefresh,
    refreshData,
    clearError,
  } = usePricingStore();

  // Initialize data on component mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await Promise.all([
          fetchCurrentPrices(),
          fetchCompetitors(1),
          fetchMarketAverages(),
        ]);
      } catch (error) {
        console.error("Failed to load initial data:", error);
      }
    };

    loadInitialData();

    // Start auto-refresh if enabled
    if (autoRefreshEnabled) {
      startAutoRefresh();
    }

    // Cleanup on unmount
    return () => {
      if (autoRefreshEnabled) {
        stopAutoRefresh();
      }
    };
  }, [
    fetchCurrentPrices,
    fetchCompetitors,
    fetchMarketAverages,
    autoRefreshEnabled,
    startAutoRefresh,
    stopAutoRefresh,
  ]);

  // Handle manual refresh
  const handleRefresh = async () => {
    try {
      await refreshData();
      toast({
        title: "Datos actualizados",
        description: "Los precios y competidores han sido actualizados.",
      });
    } catch {
      toast({
        title: "Error al actualizar",
        description: "No se pudieron actualizar los datos. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  // Handle CSV export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const validation = validateExportData(competitors);

      if (!validation.isValid) {
        toast({
          title: "Error en los datos",
          description: validation.errors.join(", "),
          variant: "destructive",
        });
        return;
      }

      if (validation.warnings.length > 0) {
        console.warn("Export warnings:", validation.warnings);
      }

      const result = await exportStationsToCSV(competitors, {
        filename: "competidores_precios",
        includeTimestamp: true,
        dateFormat: "local",
      });

      if (result.success) {
        toast({
          title: "Exportación exitosa",
          description: result.message,
        });
      } else {
        toast({
          title: "Error en la exportación",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Error inesperado durante la exportación.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle station click (for table and map)
  const handleStationClick = (station: {
    nombre: string;
    direccion: string;
    distance?: number;
  }) => {
    console.log("Station clicked:", station);
    // Could implement station detail modal here
    toast({
      title: station.nombre,
      description: `${station.direccion} - Distancia: ${station.distance?.toFixed(1)}km`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Precios Actuales
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitorea tus precios y compara con la competencia
          </p>
          {lastUpdated && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Última actualización:{" "}
              {new Date(lastUpdated).toLocaleString("es-MX")}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            <span>Actualizar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || competitors.length === 0}
            className="flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? "Exportando..." : "Exportar CSV"}</span>
          </Button>

          {autoRefreshEnabled && (
            <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Auto-actualización activa</span>
            </div>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-center justify-between">
            <p className="text-red-800 dark:text-red-200">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="text-red-800 dark:text-red-200"
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}

      {/* Current Prices Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PriceCard
          fuelType="regular"
          currentPrice={currentPrices.regular}
          marketAverage={marketAverages.regular}
          lastUpdated={lastUpdated}
          isLoading={isLoading}
        />
        <PriceCard
          fuelType="premium"
          currentPrice={currentPrices.premium}
          marketAverage={marketAverages.premium}
          lastUpdated={lastUpdated}
          isLoading={isLoading}
        />
        <PriceCard
          fuelType="diesel"
          currentPrice={currentPrices.diesel}
          marketAverage={marketAverages.diesel}
          lastUpdated={lastUpdated}
          isLoading={isLoading}
        />
      </div>

      {/* Filters */}
      <PriceFilters
        filters={filters}
        onFiltersChange={setFilters}
        availableBrands={availableBrands}
      />

      {/* Competitors Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Competencia ({competitors.length} estaciones)
          </h2>
        </div>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "table" | "map")}
        >
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="table" className="flex items-center space-x-2">
              <TableIcon className="w-4 h-4" />
              <span>Tabla</span>
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center space-x-2">
              <Map className="w-4 h-4" />
              <span>Mapa</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="table" className="space-y-4">
            <CompetitorTable
              competitors={competitors}
              isLoading={isLoading}
              onStationClick={handleStationClick}
              marketAverages={marketAverages}
            />
          </TabsContent>

          <TabsContent value="map" className="space-y-4">
            <StationMap
              stations={competitors}
              userStation={userStation}
              height="600px"
              onStationClick={handleStationClick}
              isLoading={isLoading}
              marketAverages={marketAverages}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Prices;
