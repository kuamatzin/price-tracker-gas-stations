import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FuelType } from "@fuelintel/shared";
import { MapPin, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CompetitorCardProps {
  station: {
    numero: string;
    nombre: string;
    brand?: string;
    direccion: string;
    distance: number;
    prices: {
      [key in FuelType]?: number;
    };
    lastUpdated?: string;
  };
  selectedStation?: {
    prices: {
      [key in FuelType]?: number;
    };
  };
  onCardClick?: () => void;
}

export const CompetitorCard: React.FC<CompetitorCardProps> = ({
  station,
  selectedStation,
  onCardClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getPriceComparison = (
    competitorPrice: number | undefined,
    selectedPrice: number | undefined,
  ) => {
    if (!competitorPrice || !selectedPrice)
      return { class: "", icon: null, diff: 0 };

    const percentDiff =
      ((competitorPrice - selectedPrice) / selectedPrice) * 100;

    if (percentDiff < -2)
      return {
        class: "text-green-600 bg-green-50",
        icon: <TrendingDown className="w-3 h-3" />,
        diff: percentDiff,
      };
    if (percentDiff > 2)
      return {
        class: "text-red-600 bg-red-50",
        icon: <TrendingUp className="w-3 h-3" />,
        diff: percentDiff,
      };
    return {
      class: "text-yellow-600 bg-yellow-50",
      icon: <Minus className="w-3 h-3" />,
      diff: percentDiff,
    };
  };

  const handleCardClick = () => {
    setIsExpanded(!isExpanded);
    onCardClick?.();
  };

  return (
    <Card
      className="mb-3 transition-all duration-200 active:scale-[0.98] cursor-pointer"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="font-medium text-base">{station.nombre}</p>
            <div className="flex items-center gap-2 mt-1">
              {station.brand && (
                <Badge variant="outline" className="text-xs">
                  {station.brand}
                </Badge>
              )}
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {station.distance.toFixed(1)} km
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {station.prices.regular !== undefined && (
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500 mb-1">Regular</p>
              <p className="font-semibold text-base">
                ${station.prices.regular.toFixed(2)}
              </p>
              {selectedStation?.prices.regular && (
                <div className="flex items-center gap-1 mt-1">
                  {
                    getPriceComparison(
                      station.prices.regular,
                      selectedStation.prices.regular,
                    ).icon
                  }
                  <span className="text-xs">
                    {Math.abs(
                      getPriceComparison(
                        station.prices.regular,
                        selectedStation.prices.regular,
                      ).diff,
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              )}
            </div>
          )}
          {station.prices.premium !== undefined && (
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500 mb-1">Premium</p>
              <p className="font-semibold text-base">
                ${station.prices.premium.toFixed(2)}
              </p>
              {selectedStation?.prices.premium && (
                <div className="flex items-center gap-1 mt-1">
                  {
                    getPriceComparison(
                      station.prices.premium,
                      selectedStation.prices.premium,
                    ).icon
                  }
                  <span className="text-xs">
                    {Math.abs(
                      getPriceComparison(
                        station.prices.premium,
                        selectedStation.prices.premium,
                      ).diff,
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              )}
            </div>
          )}
          {station.prices.diesel !== undefined && (
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500 mb-1">Diésel</p>
              <p className="font-semibold text-base">
                ${station.prices.diesel.toFixed(2)}
              </p>
              {selectedStation?.prices.diesel && (
                <div className="flex items-center gap-1 mt-1">
                  {
                    getPriceComparison(
                      station.prices.diesel,
                      selectedStation.prices.diesel,
                    ).icon
                  }
                  <span className="text-xs">
                    {Math.abs(
                      getPriceComparison(
                        station.prices.diesel,
                        selectedStation.prices.diesel,
                      ).diff,
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-500">{station.direccion}</p>
            {station.lastUpdated && (
              <p className="text-xs text-gray-400 mt-1">
                Actualizado:{" "}
                {new Date(station.lastUpdated).toLocaleString("es-MX")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
