import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, Navigation, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export interface MapStation {
  numero: string;
  nombre: string;
  brand?: string;
  direccion: string;
  lat: number;
  lng: number;
  distance?: number;
  regular?: number;
  premium?: number;
  diesel?: number;
  lastUpdated: string;
  isUserStation?: boolean;
}

export interface StationMapProps {
  stations: MapStation[];
  userStation?: MapStation;
  center?: [number, number];
  zoom?: number;
  height?: string;
  onStationClick?: (station: MapStation) => void;
  isLoading?: boolean;
  marketAverages?: {
    regular?: number;
    premium?: number;
    diesel?: number;
  };
}

// Custom marker icons based on price competitiveness
const createCustomIcon = (
  competitiveness: "competitive" | "average" | "expensive" | "user" | null,
  price?: number,
) => {
  let color: string;

  switch (competitiveness) {
    case "competitive":
      color = "#10b981"; // green-500
      break;
    case "expensive":
      color = "#ef4444"; // red-500
      break;
    case "average":
      color = "#f59e0b"; // amber-500
      break;
    case "user":
      color = "#3b82f6"; // blue-500
      break;
    default:
      color = "#6b7280"; // gray-500
      break;
  }

  // Create SVG icon with price label
  const priceLabel = price ? `$${price.toFixed(2)}` : "";
  const svgIcon = `
    <svg width="32" height="45" viewBox="0 0 32 45" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.164 0 0 7.164 0 16c0 16 16 29 16 29s16-13 16-29C32 7.164 24.836 0 16 0z" 
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="8" fill="white"/>
      <circle cx="16" cy="16" r="6" fill="${color}"/>
      ${
        priceLabel
          ? `<text x="16" y="40" text-anchor="middle" font-family="Arial, sans-serif" 
                   font-size="9" font-weight="bold" fill="${color}" 
                   stroke="white" stroke-width="0.5">${priceLabel}</text>`
          : ""
      }
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    iconSize: [32, 45],
    iconAnchor: [16, 45],
    popupAnchor: [0, -45],
    className: "custom-marker-icon",
  });
};

const MapController: React.FC<{
  center: [number, number];
  zoom: number;
}> = ({ center, zoom }) => {
  const map = useMap();

  const handleRecenter = () => {
    map.setView(center, zoom);
  };

  const handleZoomIn = () => {
    map.zoomIn();
  };

  const handleZoomOut = () => {
    map.zoomOut();
  };

  return (
    <div className="leaflet-control-container">
      <div className="leaflet-top leaflet-right">
        <div className="leaflet-control leaflet-bar">
          <div className="flex flex-col bg-white dark:bg-gray-800 rounded shadow-lg overflow-hidden">
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-600"
              title="Acercar"
            >
              <ZoomIn className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-600"
              title="Alejar"
            >
              <ZoomOut className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={handleRecenter}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Centrar mapa"
            >
              <RotateCcw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StationMap: React.FC<StationMapProps> = ({
  stations,
  userStation,
  center = [20.6597, -103.3496], // Guadalajara default
  zoom = 13,
  height = "400px",
  onStationClick,
  isLoading = false,
  marketAverages = {},
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>(center);

  useEffect(() => {
    // If user station is provided, center on it
    if (userStation) {
      setMapCenter([userStation.lat, userStation.lng]);
    }
  }, [userStation]);

  const formatPrice = (price: number | undefined): string => {
    if (!price || price === 0) return "N/A";
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatDistance = (distance: number | undefined): string => {
    if (!distance) return "N/A";
    return `${distance.toFixed(1)} km`;
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

      if (diffMinutes < 1) return "Hace un momento";
      if (diffMinutes < 60) return `${diffMinutes}m`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`;
      return date.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  const getPriceCompetitiveness = (
    price: number | undefined,
    marketAverage: number | undefined,
  ): "competitive" | "expensive" | "average" | null => {
    if (!price || !marketAverage || marketAverage === 0) return null;

    const difference = ((price - marketAverage) / marketAverage) * 100;
    if (difference < -2) return "competitive";
    if (difference > 2) return "expensive";
    return "average";
  };

  // Determine primary fuel type for marker color (usually regular)
  const getStationCompetitiveness = (station: MapStation) => {
    if (station.isUserStation) return "user";

    // Use regular price for competitiveness if available
    if (station.regular && marketAverages.regular) {
      return getPriceCompetitiveness(station.regular, marketAverages.regular);
    }

    // Fallback to premium or diesel
    if (station.premium && marketAverages.premium) {
      return getPriceCompetitiveness(station.premium, marketAverages.premium);
    }

    if (station.diesel && marketAverages.diesel) {
      return getPriceCompetitiveness(station.diesel, marketAverages.diesel);
    }

    return null;
  };

  if (isLoading) {
    return <StationMapSkeleton height={height} />;
  }

  const allStations = userStation ? [userStation, ...stations] : stations;

  return (
    <div className="relative" style={{ height }}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        className="rounded-lg overflow-hidden"
        zoomControl={false}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={18}
          minZoom={10}
        />

        <MapController center={mapCenter} zoom={zoom} />

        {allStations.map((station) => {
          const competitiveness = getStationCompetitiveness(station);
          const primaryPrice =
            station.regular || station.premium || station.diesel;

          return (
            <Marker
              key={station.numero}
              position={[station.lat, station.lng]}
              icon={createCustomIcon(competitiveness, primaryPrice)}
              eventHandlers={{
                click: () => {
                  onStationClick?.(station);
                },
              }}
            >
              <Popup className="custom-popup" maxWidth={300}>
                <div className="space-y-3 p-2">
                  {/* Header */}
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {station.nombre}
                      </h3>
                      {station.isUserStation && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 text-xs rounded-full">
                          Tu estación
                        </span>
                      )}
                    </div>
                    {station.brand && (
                      <div className="text-xs text-gray-600 mt-1">
                        {station.brand}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {station.direccion}
                    </div>
                  </div>

                  {/* Distance */}
                  {station.distance && (
                    <div className="flex items-center text-xs text-gray-600">
                      <Navigation className="w-3 h-3 mr-1" />
                      <span>{formatDistance(station.distance)}</span>
                    </div>
                  )}

                  {/* Prices */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-gray-500 mb-1">Regular</div>
                      <div
                        className={`font-semibold ${
                          getPriceCompetitiveness(
                            station.regular,
                            marketAverages.regular,
                          ) === "competitive"
                            ? "text-green-600"
                            : getPriceCompetitiveness(
                                  station.regular,
                                  marketAverages.regular,
                                ) === "expensive"
                              ? "text-red-600"
                              : getPriceCompetitiveness(
                                    station.regular,
                                    marketAverages.regular,
                                  ) === "average"
                                ? "text-yellow-600"
                                : "text-gray-700"
                        }`}
                      >
                        {formatPrice(station.regular)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-500 mb-1">Premium</div>
                      <div
                        className={`font-semibold ${
                          getPriceCompetitiveness(
                            station.premium,
                            marketAverages.premium,
                          ) === "competitive"
                            ? "text-green-600"
                            : getPriceCompetitiveness(
                                  station.premium,
                                  marketAverages.premium,
                                ) === "expensive"
                              ? "text-red-600"
                              : getPriceCompetitiveness(
                                    station.premium,
                                    marketAverages.premium,
                                  ) === "average"
                                ? "text-yellow-600"
                                : "text-gray-700"
                        }`}
                      >
                        {formatPrice(station.premium)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-500 mb-1">Diesel</div>
                      <div
                        className={`font-semibold ${
                          getPriceCompetitiveness(
                            station.diesel,
                            marketAverages.diesel,
                          ) === "competitive"
                            ? "text-green-600"
                            : getPriceCompetitiveness(
                                  station.diesel,
                                  marketAverages.diesel,
                                ) === "expensive"
                              ? "text-red-600"
                              : getPriceCompetitiveness(
                                    station.diesel,
                                    marketAverages.diesel,
                                  ) === "average"
                                ? "text-yellow-600"
                                : "text-gray-700"
                        }`}
                      >
                        {formatPrice(station.diesel)}
                      </div>
                    </div>
                  </div>

                  {/* Last Updated */}
                  <div className="text-xs text-gray-500 border-t pt-2">
                    Actualizado {formatTimestamp(station.lastUpdated)}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute top-4 left-4 z-[1000]">
        <Card className="p-3 bg-white/95 backdrop-blur-sm">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Leyenda</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-gray-700">Tu estación</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-700">Precio competitivo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-gray-700">Precio promedio</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-700">Precio elevado</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

const StationMapSkeleton: React.FC<{ height: string }> = ({ height }) => {
  return (
    <Card
      className="bg-gray-100 dark:bg-gray-800 flex items-center justify-center animate-pulse rounded-lg"
      style={{ height }}
    >
      <div className="text-center space-y-2">
        <MapPin className="w-8 h-8 text-gray-400 mx-auto" />
        <div className="text-gray-500 dark:text-gray-400 text-sm">
          Cargando mapa...
        </div>
      </div>
    </Card>
  );
};

export default StationMap;
