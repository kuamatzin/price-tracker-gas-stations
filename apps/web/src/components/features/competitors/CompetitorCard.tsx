import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FuelType } from "@fuelintel/shared";

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
  };
  selectedStation?: {
    prices: {
      [key in FuelType]?: number;
    };
  };
}

export const CompetitorCard: React.FC<CompetitorCardProps> = ({
  station,
  selectedStation,
}) => {
  const getPriceComparisonClass = (
    competitorPrice: number | undefined,
    selectedPrice: number | undefined,
  ) => {
    if (!competitorPrice || !selectedPrice) return "";

    const percentDiff =
      ((competitorPrice - selectedPrice) / selectedPrice) * 100;

    if (percentDiff < -2) return "text-green-600";
    if (percentDiff > 2) return "text-red-600";
    return "text-yellow-600";
  };

  return (
    <Card className="mb-3">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium">{station.nombre}</p>
            <p className="text-sm text-gray-500">
              {station.brand && <span>{station.brand} • </span>}
              {station.distance.toFixed(1)} km
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 text-sm">
          {station.prices.regular && (
            <div>
              <p className="text-gray-500">Regular</p>
              <p
                className={`font-medium ${
                  selectedStation
                    ? getPriceComparisonClass(
                        station.prices.regular,
                        selectedStation.prices.regular,
                      )
                    : ""
                }`}
              >
                ${station.prices.regular.toFixed(2)}
              </p>
            </div>
          )}
          {station.prices.premium && (
            <div>
              <p className="text-gray-500">Premium</p>
              <p
                className={`font-medium ${
                  selectedStation
                    ? getPriceComparisonClass(
                        station.prices.premium,
                        selectedStation.prices.premium,
                      )
                    : ""
                }`}
              >
                ${station.prices.premium.toFixed(2)}
              </p>
            </div>
          )}
          {station.prices.diesel && (
            <div>
              <p className="text-gray-500">Diésel</p>
              <p
                className={`font-medium ${
                  selectedStation
                    ? getPriceComparisonClass(
                        station.prices.diesel,
                        selectedStation.prices.diesel,
                      )
                    : ""
                }`}
              >
                ${station.prices.diesel.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
