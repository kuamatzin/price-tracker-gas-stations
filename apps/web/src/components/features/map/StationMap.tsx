import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { FuelType } from "@fuelintel/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";
import {
  calculateCompetitiveness,
  getPriceColor,
} from "@/utils/priceComparison";

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

interface StationData {
  numero: string;
  nombre: string;
  brand?: string;
  direccion: string;
  lat: number;
  lng: number;
  prices: {
    [key in FuelType]?: number;
  };
  isSelected?: boolean;
}

interface StationMapProps {
  selectedStation: StationData;
  competitors: StationData[];
  onStationClick?: (station: StationData) => void;
  className?: string;
}

const MAP_CONFIG = {
  center: { lat: 20.6597, lng: -103.3496 } as L.LatLngExpression,
  zoom: 13,
  maxZoom: 18,
  minZoom: 10,
  tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
  // Mobile optimizations
  zoomControl: false,
  tapTolerance: 10,
  touchZoom: true,
  dragging: true,
};

// Custom map component to handle re-centering
const MapController: React.FC<{ center: L.LatLngExpression; zoom: number }> = ({
  center,
  zoom,
}) => {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);

  return null;
};

// Create custom icons for different price levels
const createMarkerIcon = (color: string, isSelected: boolean = false) => {
  const size = isSelected ? 35 : 25;
  const iconHtml = `
    <div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid ${isSelected ? "#1f2937" : "#ffffff"};
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>
  `;

  return L.divIcon({
    html: iconHtml,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    className: "custom-marker-icon",
  });
};

const getPriceCompetitiveness = (
  stationPrice: number | undefined,
  selectedPrice: number | undefined,
): "competitive" | "average" | "expensive" | "unknown" => {
  if (!stationPrice || !selectedPrice) return "unknown";

  return calculateCompetitiveness(stationPrice, selectedPrice, 2);
};

const getMarkerColor = (
  competitiveness: "competitive" | "average" | "expensive" | "unknown",
): string => {
  if (competitiveness === "unknown") {
    return "#9ca3af"; // gray
  }
  return getPriceColor(competitiveness);
};

export const StationMap: React.FC<StationMapProps> = ({
  selectedStation,
  competitors,
  onStationClick,
  className,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const center: L.LatLngExpression = [selectedStation.lat, selectedStation.lng];

  // Get average price for regular fuel from selected station
  const selectedRegularPrice = selectedStation.prices.regular;

  return (
    <Card className={className}>
      <div className="h-[500px] relative rounded-lg overflow-hidden">
        <MapContainer
          center={center}
          zoom={MAP_CONFIG.zoom}
          maxZoom={MAP_CONFIG.maxZoom}
          minZoom={MAP_CONFIG.minZoom}
          className="h-full w-full"
          ref={mapRef}
        >
          <TileLayer
            url={MAP_CONFIG.tileUrl}
            attribution={MAP_CONFIG.attribution}
          />

          <MapController center={center} zoom={MAP_CONFIG.zoom} />

          {/* Selected Station Marker */}
          <Marker
            position={[selectedStation.lat, selectedStation.lng]}
            icon={createMarkerIcon("#3b82f6", true)}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-bold text-sm">{selectedStation.nombre}</h3>
                <p className="text-xs text-gray-600">
                  {selectedStation.brand || "Sin marca"}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedStation.direccion}
                </p>
                <div className="mt-2 space-y-1">
                  {selectedStation.prices.regular && (
                    <p className="text-xs">
                      <span className="font-medium">Regular:</span> $
                      {selectedStation.prices.regular.toFixed(2)}
                    </p>
                  )}
                  {selectedStation.prices.premium && (
                    <p className="text-xs">
                      <span className="font-medium">Premium:</span> $
                      {selectedStation.prices.premium.toFixed(2)}
                    </p>
                  )}
                  {selectedStation.prices.diesel && (
                    <p className="text-xs">
                      <span className="font-medium">Diésel:</span> $
                      {selectedStation.prices.diesel.toFixed(2)}
                    </p>
                  )}
                </div>
                <p className="text-xs text-blue-600 font-medium mt-2">
                  Estación seleccionada
                </p>
              </div>
            </Popup>
          </Marker>

          {/* Competitor Markers */}
          {competitors.map((station) => {
            const competitiveness = getPriceCompetitiveness(
              station.prices.regular,
              selectedRegularPrice,
            );
            const color = getMarkerColor(competitiveness);

            return (
              <Marker
                key={station.numero}
                position={[station.lat, station.lng]}
                icon={createMarkerIcon(color, false)}
                eventHandlers={{
                  click: () => onStationClick?.(station),
                }}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-bold text-sm">{station.nombre}</h3>
                    <p className="text-xs text-gray-600">
                      {station.brand || "Sin marca"}
                    </p>
                    <p className="text-xs text-gray-500">{station.direccion}</p>
                    <div className="mt-2 space-y-1">
                      {station.prices.regular && (
                        <p className="text-xs">
                          <span className="font-medium">Regular:</span> $
                          {station.prices.regular.toFixed(2)}
                          {selectedRegularPrice && (
                            <span
                              className={`ml-1 ${
                                competitiveness === "competitive"
                                  ? "text-green-600"
                                  : competitiveness === "expensive"
                                    ? "text-red-600"
                                    : "text-yellow-600"
                              }`}
                            >
                              (
                              {station.prices.regular > selectedRegularPrice
                                ? "+"
                                : ""}
                              {(
                                station.prices.regular - selectedRegularPrice
                              ).toFixed(2)}
                              )
                            </span>
                          )}
                        </p>
                      )}
                      {station.prices.premium && (
                        <p className="text-xs">
                          <span className="font-medium">Premium:</span> $
                          {station.prices.premium.toFixed(2)}
                        </p>
                      )}
                      {station.prices.diesel && (
                        <p className="text-xs">
                          <span className="font-medium">Diésel:</span> $
                          {station.prices.diesel.toFixed(2)}
                        </p>
                      )}
                    </div>
                    {onStationClick && (
                      <button
                        className="text-xs text-blue-600 hover:text-blue-800 mt-2 underline"
                        onClick={() => onStationClick(station)}
                      >
                        Seleccionar estación
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Mobile-friendly Legend */}
        <div className="absolute bottom-4 left-4 md:left-auto md:right-4 bg-white p-2 md:p-3 rounded-lg shadow-md z-[1000] max-w-[140px] md:max-w-none">
          <p className="text-xs font-medium mb-2 hidden md:block">
            Leyenda de precios
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-xs">Competitivo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-xs">Promedio</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-xs">Caro</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-gray-900"></div>
              <span className="text-xs">Tu estación</span>
            </div>
          </div>
        </div>

        {/* Mobile Center Button */}
        <div className="absolute bottom-4 right-4 md:hidden">
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full shadow-lg h-10 w-10 p-0"
            onClick={() => {
              if (mapRef.current) {
                mapRef.current.setView(
                  [selectedStation.lat, selectedStation.lng],
                  MAP_CONFIG.zoom,
                );
              }
            }}
          >
            <Navigation className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
