import React from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { FuelType } from "@fuelintel/shared";

interface StationMarkerProps {
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
  competitiveness?: "competitive" | "average" | "expensive" | "unknown";
  onStationClick?: () => void;
}

const createIcon = (color: string, isSelected: boolean = false) => {
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
      position: relative;
    ">
      ${isSelected ? '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(45deg); color: white; font-size: 12px; font-weight: bold;">★</div>' : ""}
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    className: "custom-station-marker",
  });
};

const getMarkerColor = (
  competitiveness?: "competitive" | "average" | "expensive" | "unknown",
): string => {
  switch (competitiveness) {
    case "competitive":
      return "#10b981"; // green
    case "expensive":
      return "#ef4444"; // red
    case "average":
      return "#f59e0b"; // yellow
    default:
      return "#9ca3af"; // gray
  }
};

export const StationMarker: React.FC<StationMarkerProps> = ({
  nombre,
  brand,
  direccion,
  lat,
  lng,
  prices,
  isSelected = false,
  competitiveness,
  onStationClick,
}) => {
  const color = isSelected ? "#3b82f6" : getMarkerColor(competitiveness);
  const icon = createIcon(color, isSelected);

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      eventHandlers={{
        click: onStationClick ? () => onStationClick() : undefined,
      }}
    >
      <Popup>
        <div className="p-2 min-w-[200px]">
          <h3 className="font-bold text-sm mb-1">{nombre}</h3>
          {brand && <p className="text-xs text-gray-600 mb-1">{brand}</p>}
          <p className="text-xs text-gray-500 mb-2">{direccion}</p>

          <div className="space-y-1 border-t pt-2">
            {prices.regular && (
              <div className="flex justify-between text-xs">
                <span className="font-medium">Regular:</span>
                <span>${prices.regular.toFixed(2)}</span>
              </div>
            )}
            {prices.premium && (
              <div className="flex justify-between text-xs">
                <span className="font-medium">Premium:</span>
                <span>${prices.premium.toFixed(2)}</span>
              </div>
            )}
            {prices.diesel && (
              <div className="flex justify-between text-xs">
                <span className="font-medium">Diésel:</span>
                <span>${prices.diesel.toFixed(2)}</span>
              </div>
            )}
          </div>

          {isSelected && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs text-blue-600 font-medium">
                Estación seleccionada
              </p>
            </div>
          )}

          {onStationClick && !isSelected && (
            <button
              className="mt-2 w-full text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
              onClick={onStationClick}
            >
              Seleccionar estación
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  );
};
