import React, { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceCard } from "@/components/features/pricing/PriceCard";
import { CompetitorTable } from "@/components/features/competitors/CompetitorTable";
import { StationMap } from "@/components/features/map/StationMap";
import { PriceFilters } from "@/components/features/filters/PriceFilters";
import { usePricingStore } from "@/stores/pricingStore";
import { pricingService } from "@/services/pricing.service";
import { exportToCSV, prepareCompetitorData } from "@/utils/csvExport";
import { FuelType } from "@fuelintel/shared";
import { RefreshCw, Download, MapPin, Table2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

export const CurrentPrices: React.FC = () => {
  const [activeTab, setActiveTab] = useState("table");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { user } = useAuthStore();
  const {
    selectedStation,
    filters,
    isLoadingPrices,
    isLoadingCompetitors,
    pricesError,
    competitorsError,
    getStationPrices,
    getFilteredCompetitors,
    setSelectedStation,
  } = usePricingStore();

  // Mock selected station if user has one assigned
  useEffect(() => {
    if (user?.station && !selectedStation) {
      setSelectedStation({
        numero: user.station.numero,
        nombre: user.station.nombre,
        brand: "Pemex", // Default brand
        direccion: `${user.station.municipio}, ${user.station.entidad}`,
        lat: 20.6597, // Mock coordinates for Guadalajara
        lng: -103.3496,
        entidad_id: 14,
        municipio_id: 39,
        is_active: true,
      });
    }
  }, [user, selectedStation, setSelectedStation]);

  // Fetch data when station is selected
  useEffect(() => {
    if (selectedStation) {
      pricingService.getCurrentPrices(selectedStation.numero);
      pricingService.getNearbyCompetitors(selectedStation.numero);
    }
  }, [selectedStation]);

  const handleRefresh = async () => {
    if (!selectedStation) return;

    setIsRefreshing(true);
    try {
      await pricingService.refreshStationData(selectedStation.numero);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    setIsExporting(true);

    const filteredCompetitors = getFilteredCompetitors();
    const exportData = prepareCompetitorData(filteredCompetitors);

    exportToCSV(exportData, "precios_competidores", {
      stationNumero: selectedStation?.numero,
      stationName: selectedStation?.nombre,
      includeFiltered:
        filters.brands.length > 0 ||
        filters.fuelType !== "all" ||
        filters.radius !== 10,
      timestamp: new Date(),
    });

    setTimeout(() => setIsExporting(false), 500);
  };

  const handleStationClick = (station: {
    numero: string;
    nombre: string;
    brand?: string;
    direccion: string;
    lat: number;
    lng: number;
  }) => {
    setSelectedStation({
      numero: station.numero,
      nombre: station.nombre,
      brand: station.brand,
      direccion: station.direccion,
      lat: station.lat,
      lng: station.lng,
      entidad_id: selectedStation?.entidad_id || 14,
      municipio_id: selectedStation?.municipio_id || 39,
      is_active: true,
    });
  };

  const stationPrices = selectedStation
    ? getStationPrices(selectedStation.numero)
    : undefined;
  const filteredCompetitors = getFilteredCompetitors();

  // Transform prices for display
  const priceCards = stationPrices
    ? [
        {
          fuelType: FuelType.REGULAR,
          currentPrice:
            stationPrices.find((p) => p.fuel_type === FuelType.REGULAR)
              ?.price || 0,
          previousPrice: stationPrices.find(
            (p) => p.fuel_type === FuelType.REGULAR,
          )?.previousPrice,
          lastUpdated:
            stationPrices.find((p) => p.fuel_type === FuelType.REGULAR)
              ?.detected_at || "",
        },
        {
          fuelType: FuelType.PREMIUM,
          currentPrice:
            stationPrices.find((p) => p.fuel_type === FuelType.PREMIUM)
              ?.price || 0,
          previousPrice: stationPrices.find(
            (p) => p.fuel_type === FuelType.PREMIUM,
          )?.previousPrice,
          lastUpdated:
            stationPrices.find((p) => p.fuel_type === FuelType.PREMIUM)
              ?.detected_at || "",
        },
        {
          fuelType: FuelType.DIESEL,
          currentPrice:
            stationPrices.find((p) => p.fuel_type === FuelType.DIESEL)?.price ||
            0,
          previousPrice: stationPrices.find(
            (p) => p.fuel_type === FuelType.DIESEL,
          )?.previousPrice,
          lastUpdated:
            stationPrices.find((p) => p.fuel_type === FuelType.DIESEL)
              ?.detected_at || "",
        },
      ]
    : [];

  // Calculate market averages
  const marketAverages = {
    [FuelType.REGULAR]:
      filteredCompetitors.reduce((sum, c) => sum + (c.prices.regular || 0), 0) /
        filteredCompetitors.filter((c) => c.prices.regular).length || 0,
    [FuelType.PREMIUM]:
      filteredCompetitors.reduce((sum, c) => sum + (c.prices.premium || 0), 0) /
        filteredCompetitors.filter((c) => c.prices.premium).length || 0,
    [FuelType.DIESEL]:
      filteredCompetitors.reduce((sum, c) => sum + (c.prices.diesel || 0), 0) /
        filteredCompetitors.filter((c) => c.prices.diesel).length || 0,
  };

  if (!selectedStation) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8">
          <CardContent>
            <p className="text-gray-500">
              No hay estación seleccionada. Por favor selecciona una estación
              para ver los precios.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Precios Actuales</h1>
          <p className="text-gray-500">
            {selectedStation.nombre} - #{selectedStation.numero}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || filteredCompetitors.length === 0}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Error Messages */}
      {(pricesError || competitorsError) && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{pricesError || competitorsError}</p>
          </CardContent>
        </Card>
      )}

      {/* Price Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {priceCards.map((price) => (
          <PriceCard
            key={price.fuelType}
            station_numero={selectedStation.numero}
            stationName={selectedStation.nombre}
            fuelType={price.fuelType}
            currentPrice={price.currentPrice}
            previousPrice={price.previousPrice}
            lastUpdated={price.lastUpdated}
            marketAverage={marketAverages[price.fuelType]}
            isLoading={isLoadingPrices}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Filters */}
        <div className="lg:col-span-1">
          <PriceFilters
            className="sticky top-4"
            onFiltersChange={handleRefresh}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Competidores</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                  <TabsTrigger value="table">
                    <Table2 className="h-4 w-4 mr-2" />
                    Tabla
                  </TabsTrigger>
                  <TabsTrigger value="map">
                    <MapPin className="h-4 w-4 mr-2" />
                    Mapa
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="table" className="mt-4">
                  <CompetitorTable
                    selectedStation={{
                      lat: selectedStation.lat,
                      lng: selectedStation.lng,
                      numero: selectedStation.numero,
                      prices: {
                        regular: priceCards[0]?.currentPrice,
                        premium: priceCards[1]?.currentPrice,
                        diesel: priceCards[2]?.currentPrice,
                      },
                    }}
                    competitors={filteredCompetitors}
                    isLoading={isLoadingCompetitors}
                  />
                </TabsContent>

                <TabsContent value="map" className="mt-4">
                  <StationMap
                    selectedStation={{
                      numero: selectedStation.numero,
                      nombre: selectedStation.nombre,
                      brand: selectedStation.brand,
                      direccion: selectedStation.direccion,
                      lat: selectedStation.lat,
                      lng: selectedStation.lng,
                      prices: {
                        regular: priceCards[0]?.currentPrice,
                        premium: priceCards[1]?.currentPrice,
                        diesel: priceCards[2]?.currentPrice,
                      },
                    }}
                    competitors={filteredCompetitors.map((c) => ({
                      numero: c.numero,
                      nombre: c.nombre,
                      brand: c.brand,
                      direccion: c.direccion,
                      lat: c.lat,
                      lng: c.lng,
                      prices: c.prices,
                    }))}
                    onStationClick={handleStationClick}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
